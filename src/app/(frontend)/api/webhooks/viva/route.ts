import { NextRequest, NextResponse } from 'next/server'

import { finalizeBookingFromVivaTransaction } from '@/lib/bookings/finalize'

/**
 * VIVA's webhook source addresses, confirmed by VIVA technical support.
 *
 * VIVA does NOT sign notification POSTs: their documented model is source-IP
 * allowlisting plus re-reading the transaction from their API (which we do
 * below, and which VIVA explicitly recommend over trusting the payload).
 * Before this, we required a shared-secret header that VIVA never sends —
 * so every notification from a live account would have been rejected with
 * 401 and retried hourly for 24 hours.
 *
 * Both the live and demo ranges are allowed unconditionally. Both lists are
 * VIVA-owned infrastructure, so allowing the inactive set grants no access
 * to anyone outside VIVA, and it removes a failure mode where the
 * demo/live flag and the account state disagree mid-switch.
 */
const VIVA_WEBHOOK_SOURCES = [
  // Production
  '51.138.37.238',
  '40.127.253.112/28',
  '51.105.129.192/28',
  '20.54.89.16',
  '4.223.76.50',
  '51.12.157.0/28',
  // Demo
  '20.50.240.57',
  '40.74.20.78',
  '195.167.87.181',
  '195.167.87.180',
  '20.13.195.185',
  '135.225.16.50',
]

/** Dotted-quad IPv4 to uint32, or null when it is not a bare IPv4 address. */
function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return null
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  if (parts.some((p) => p > 255)) return null
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

/** True when `ip` (as uint32) falls inside `cidr` (a bare IP means /32). */
function inCidr(ip: number, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split('/')
  const baseInt = ipv4ToInt(base)
  if (baseInt === null) return false
  const bits = bitsRaw === undefined ? 32 : Number(bitsRaw)
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (ip & mask) === (baseInt & mask)
}

/**
 * The originating client IP.
 *
 * Takes the LAST X-Forwarded-For hop, not the first: the first entry is
 * whatever the caller chose to send, so allowlisting on it would be trivially
 * spoofable by anyone claiming to be a VIVA address. The last entry is the one
 * appended by our own ingress (Azure Container Apps), which the caller cannot
 * control.
 */
function clientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const hops = xff.split(',').map((h) => h.trim()).filter(Boolean)
    const last = hops[hops.length - 1]
    if (last) return normalizeIp(last)
  }
  const real = headers.get('x-real-ip')?.trim()
  return real ? normalizeIp(real) : null
}

/** Strip an IPv4-mapped IPv6 prefix and any :port / [] decoration. */
function normalizeIp(raw: string): string {
  const noPort = raw.replace(/^\[/, '').replace(/\]:?\d*$/, '').replace(/:\d+$/, '')
  return noPort.startsWith('::ffff:') ? noPort.slice(7) : noPort
}

/**
 * Whether this request plausibly came from VIVA.
 *
 * A local loopback/private address is also accepted outside production, so the
 * endpoint can be exercised during development. A production build sets
 * NODE_ENV=production, so that branch is dead in both deployed environments.
 */
function isVivaSource(req: NextRequest): boolean {
  const ip = clientIp(req.headers)
  if (!ip) return false
  const asInt = ipv4ToInt(ip)
  if (asInt === null) return false
  if (VIVA_WEBHOOK_SOURCES.some((cidr) => inCidr(asInt, cidr))) return true
  if (process.env.NODE_ENV !== 'production') {
    return ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'].some((cidr) =>
      inCidr(asInt, cidr),
    )
  }
  return false
}

/**
 * POST /api/webhooks/viva: VIVA notification receiver.
 *
 * VIVA sends a JSON payload with EventData containing:
 * - OrderCode: the order created at checkout
 * - TransactionId: UUID of the completed payment
 * - StatusId: 'F' = completed/success
 * - Amount: in cents
 * - Email, FullName, MerchantTrns (our booking reference)
 *
 * Security:
 * - The shared secret (X-Viva-Secret / Authorization: Bearer) is verified
 *   whenever VIVA_WEBHOOK_SECRET is set. It is only skipped in demo mode
 *   with no secret configured (local/sandbox testing).
 * - The body is treated as a HINT only. We ALWAYS fetch the transaction
 *   from the VIVA API and finalise using the API-verified OrderCode,
 *   amount and merchantTrns: the body's OrderCode must match the
 *   transaction's, the amount must equal the booking total, and a
 *   TransactionId can confirm exactly one booking (see finalize.ts).
 *   This is what makes the unauthenticated demo path safe: forging a
 *   webhook still requires a real, fully-paid transaction for that exact
 *   order.
 *
 * Idempotent: returns 200 for already-processed transactions.
 *
 * GET requests are used by Viva's URL verification when creating a webhook.
 */
export async function GET() {
  try {
    const { getWebhookVerificationKey } = await import('@/lib/viva/client')
    const key = await getWebhookVerificationKey()
    // Viva's code example uses lowercase { key: ... } in the response body
    return NextResponse.json({ Key: key }, { status: 200 })
  } catch (err) {
    console.error('[webhooks/viva] Webhook verification key retrieval failed:', err)
    return NextResponse.json({ error: 'webhook_verification_unavailable' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  // ── Auth: VIVA source-IP allowlist (they do not sign POSTs) ──
  if (!isVivaSource(req)) {
    console.warn('[webhooks/viva] Rejected: source IP not in the VIVA allowlist', {
      ip: clientIp(req.headers),
    })
    return NextResponse.json({ error: 'forbidden_source' }, { status: 401 })
  }

  // ── Parse payload ──
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const data = body as {
    EventTypeId?: number
    EventData?: {
      OrderCode?: number
      TransactionId?: string
      StatusId?: string
      Amount?: number
      CurrencyCode?: number
      Email?: string
      FullName?: string
      MerchantTrns?: string
      SourceCode?: string
      SourceName?: string
      CardNumber?: string
      CardTypeId?: number
      InsDate?: string
      ResponseCode?: string
      ReferenceNumber?: number
    }
  }

  // ── Only successful payments (EventTypeId 1796) confirm a booking ──
  // VIVA recommends subscribing to several events: 1796 payments, 1797 refunds,
  // 1798 failed payments, 4865 order cancellations. We deliberately act on 1796
  // only. A refund event can itself carry a completed status, so without this
  // gate the handler would try to finalise a booking from a reversal's
  // transaction, fail the order-code match and answer 400 -- which VIVA then
  // retries 24 times, hourly. Anything we do not act on gets a 200.
  if (typeof data.EventTypeId !== 'number') {
    return NextResponse.json({ error: 'missing_event_type' }, { status: 400 })
  }
  if (data.EventTypeId !== 1796) {
    console.info('[webhooks/viva] Ignoring event type', data.EventTypeId)
    return NextResponse.json({ received: true, ignored: 'event_type' }, { status: 200 })
  }

  const eventData = data.EventData
  if (!eventData) {
    return NextResponse.json({ error: 'missing_event_data' }, { status: 400 })
  }

  // Only process successful payments
  if (eventData.StatusId !== 'F') {
    console.info('[webhooks/viva] Ignoring non-successful transaction', eventData.TransactionId, 'status:', eventData.StatusId)
    return NextResponse.json({ received: true, skipped: 'non_success' }, { status: 200 })
  }

  if (!eventData.TransactionId || !eventData.OrderCode) {
    return NextResponse.json({ error: 'missing_transaction_id_or_order_code' }, { status: 400 })
  }

  // ── Defence-in-depth: verify transaction via VIVA API ──
  const { getTransaction } = await import('@/lib/viva/client')
  let verifiedTransaction: { amount: number; statusId: string; orderCode?: number | string; merchantTrns?: string }
  try {
    const tx = await getTransaction(eventData.TransactionId)
    verifiedTransaction = { amount: tx.amount, statusId: tx.statusId, orderCode: tx.orderCode, merchantTrns: tx.merchantTrns }
  } catch (err) {
    console.error('[webhooks/viva] Transaction verification failed:', err)
    return NextResponse.json({ error: 'verification_failed' }, { status: 502 })
  }

  if (verifiedTransaction.statusId !== 'F') {
    console.warn('[webhooks/viva] API-verified transaction not completed:', verifiedTransaction.statusId)
    return NextResponse.json({ received: true, skipped: 'api_not_completed' }, { status: 200 })
  }

  // The body's OrderCode must be the order this transaction actually paid
  // for; otherwise a real transaction could be pointed at someone else's
  // pending booking.
  if (verifiedTransaction.orderCode == null || String(verifiedTransaction.orderCode) !== String(eventData.OrderCode)) {
    console.warn('[webhooks/viva] OrderCode in webhook body does not match verified transaction', {
      bodyOrderCode: eventData.OrderCode,
      verifiedOrderCode: verifiedTransaction.orderCode,
      transactionId: eventData.TransactionId,
    })
    return NextResponse.json({ error: 'order_code_mismatch' }, { status: 400 })
  }

  // ── Finalise the booking using ONLY API-verified values ──
  const result = await finalizeBookingFromVivaTransaction({
    orderCode: String(verifiedTransaction.orderCode),
    transactionId: eventData.TransactionId,
    amount: verifiedTransaction.amount,
    merchantTrns: verifiedTransaction.merchantTrns,
  })

  if (!result.ok) {
    console.error('[webhooks/viva] Booking finalisation failed:', result.reason)
    return NextResponse.json({ received: true, warning: result.reason }, { status: 200 })
  }

  return NextResponse.json({ received: true }, { status: 200 })
}