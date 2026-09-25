import { NextRequest, NextResponse } from 'next/server'

import { isVivaWebhookConfigured, vivaMerchantId, isVivaDemo } from '@/lib/env'
import { finalizeBookingFromVivaTransaction } from '@/lib/bookings/finalize'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * POST /api/webhooks/viva — Transaction Payment Created webhook.
 *
 * VIVA sends a JSON payload with EventData containing:
 * - OrderCode: the order created at checkout
 * - TransactionId: UUID of the completed payment
 * - StatusId: 'F' = completed/success
 * - Amount: in cents
 * - Email, FullName, MerchantTrns (our booking reference)
 *
 * Security:
 * - In production, we verify the webhook secret header (X-Viva-Secret)
 * - In demo mode, we allow unverified requests (for testing)
 * - We ALWAYS verify the transaction via the VIVA API as defence-in-depth
 *
 * Idempotent: returns 200 for already-processed transactions.
 */
export async function POST(req: NextRequest) {
  // ── Auth check ──
  if (!isVivaDemo()) {
    if (!isVivaWebhookConfigured()) {
      return NextResponse.json(
        { error: 'webhook_not_configured', message: 'VIVA_WEBHOOK_SECRET is not set.' },
        { status: 503 },
      )
    }

    const expectedSecret = process.env.VIVA_WEBHOOK_SECRET
    const providedSecret = req.headers.get('x-viva-secret')
    if (!providedSecret || providedSecret !== expectedSecret) {
      // Also check Authorization: Bearer header as some VIVA configs use this
      const authHeader = req.headers.get('authorization')
      if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
        console.warn('[webhooks/viva] Invalid webhook auth')
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      }
    }
  }

  // ── Parse payload ──
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const data = body as {
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
  let verifiedTransaction: { amount: number; statusId: string }
  try {
    const tx = await getTransaction(eventData.TransactionId)
    verifiedTransaction = { amount: tx.amount, statusId: tx.statusId }
  } catch (err) {
    console.error('[webhooks/viva] Transaction verification failed:', err)
    return NextResponse.json({ error: 'verification_failed' }, { status: 502 })
  }

  if (verifiedTransaction.statusId !== 'F') {
    console.warn('[webhooks/viva] API-verified transaction not completed:', verifiedTransaction.statusId)
    return NextResponse.json({ received: true, skipped: 'api_not_completed' }, { status: 200 })
  }

  // ── Finalise the booking ──
  const result = await finalizeBookingFromVivaTransaction({
    orderCode: String(eventData.OrderCode),
    transactionId: eventData.TransactionId,
    amount: eventData.Amount ?? verifiedTransaction.amount,
    merchantTrns: eventData.MerchantTrns,
  })

  if (!result.ok) {
    console.error('[webhooks/viva] Booking finalisation failed:', result.reason)
    return NextResponse.json({ received: true, warning: result.reason }, { status: 200 })
  }

  return NextResponse.json({ received: true }, { status: 200 })
}