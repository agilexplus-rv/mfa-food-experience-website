import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

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
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json({ error: 'missing_session_id' }, { status: 400 })
  }

  const p = await payload()

  let result
  if (sessionId.startsWith('viva:')) {
    const orderCode = sessionId.slice(5)
    result = await p.find({
      collection: 'bookings',
      where: { vivaOrderCode: { equals: orderCode } },
      limit: 1,
      overrideAccess: true,
    })
  } else {
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
