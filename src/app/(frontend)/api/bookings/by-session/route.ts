import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { parseStripeSessionId, parseVivaOrderCode } from '@/lib/bookings/lookup'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * GET /api/bookings/by-session?session_id=...
 *
 * Resolves a payment session identifier back to a booking.
 *
 * - Legacy Stripe: session_id is a Stripe Checkout Session id (e.g. cs_test_...)
 *   → lookup via stripeCheckoutSessionId.
 * - VIVA: session_id is "viva:{orderCode}" → lookup via vivaOrderCode.
 *
 * The confirmation/cancel pages then poll /api/bookings/[id]/status.
 *
 * Same data-minimisation posture as the status endpoint: no PII returned.
 * Rate-limited and format-validated so the OrderCode space cannot be
 * scanned cheaply (the OrderCode unlocks the confirmation page's PII).
 */
const rateLimiter = createRateLimiter({ windowMs: 60_000, max: 30 })

export async function GET(req: NextRequest) {
  rateLimiter.maybeCleanup()
  if (!rateLimiter.check(getClientIp(req))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json({ error: 'missing_session_id' }, { status: 400 })
  }

  const p = await payload()

  let result
  if (sessionId.startsWith('viva:')) {
    const orderCode = parseVivaOrderCode(sessionId.slice(5))
    if (!orderCode) {
      return NextResponse.json({ error: 'invalid_session_id' }, { status: 400 })
    }
    result = await p.find({
      collection: 'bookings',
      where: { vivaOrderCode: { equals: orderCode } },
      limit: 1,
      overrideAccess: true,
    })
  } else {
    if (!parseStripeSessionId(sessionId)) {
      return NextResponse.json({ error: 'invalid_session_id' }, { status: 400 })
    }
    result = await p.find({
      collection: 'bookings',
      where: { stripeCheckoutSessionId: { equals: sessionId } },
      limit: 1,
      overrideAccess: true,
    })
  }

  const booking = result.docs[0] as { id: string | number; reference: string; status: string } | undefined
  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ id: booking.id, reference: booking.reference, status: booking.status })
}
