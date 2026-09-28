import { NextRequest, NextResponse } from 'next/server'

import { findBookingByPaymentRef, parseVivaOrderCode, parseVivaTransactionId } from '@/lib/bookings/lookup'
import { reconcileVivaPayment } from '@/lib/bookings/reconcile-viva'
import { createRateLimiter, getClientIp, isSameOriginRequest } from '@/lib/rate-limit'

/**
 * POST /api/bookings/verify-viva  { orderCode, transactionId }
 *
 * Called by the confirmation page's ConfirmationStatus when the booking
 * is still 'pending' after a few polls, and on "Check again". Asks the
 * VIVA API whether the transaction completed and, if so, finalises the
 * booking exactly like the webhook would (see reconcile-viva.ts for the
 * verification guarantees). This is what un-sticks the page in VIVA demo
 * mode, where webhooks are not delivered.
 *
 * Returns only the booking status (no PII). Rate-limited tightly: every
 * call costs a VIVA API round trip, and the UI needs only a handful.
 *
 * If VIVA itself is down and the booking is still pending, responds 503
 * { error: 'viva_unreachable' } so the page can show its "payment service
 * temporarily unavailable" state instead of polling forever.
 */
const rateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 })

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  rateLimiter.maybeCleanup()
  if (!rateLimiter.check(getClientIp(req))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: { orderCode?: unknown; transactionId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const orderCode = parseVivaOrderCode(typeof body.orderCode === 'string' ? body.orderCode : undefined)
  const transactionId = parseVivaTransactionId(typeof body.transactionId === 'string' ? body.transactionId : undefined)
  if (!orderCode || !transactionId) {
    return NextResponse.json({ error: 'invalid_reference' }, { status: 400 })
  }

  const before = await findBookingByPaymentRef({ vivaOrderCode: orderCode })
  if (before.kind === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (before.kind === 'error') return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })

  // Only a pending booking can be moved; anything else is already final.
  if (before.booking.status !== 'pending') {
    return NextResponse.json({ status: before.booking.status })
  }

  const outcome = await reconcileVivaPayment({ orderCode, transactionId })

  const after = await findBookingByPaymentRef({ vivaOrderCode: orderCode })
  const status = after.kind === 'found' ? after.booking.status : before.booking.status
  if (outcome === 'unreachable' && status === 'pending') {
    return NextResponse.json(
      { error: 'viva_unreachable', message: 'Payment service temporarily unavailable', status },
      { status: 503, headers: { 'Retry-After': '30' } },
    )
  }
  return NextResponse.json({ status, outcome })
}
