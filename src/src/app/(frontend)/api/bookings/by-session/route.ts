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
 * GET /api/bookings/by-session?session_id=cs_test_...
 *
 * Resolves a Stripe Checkout Session id (the only identifier Stripe's
 * success_url/cancel_url redirect carries, per ADR-004) back to a
 * booking id, so the confirmation/cancel pages can then poll
 * /api/bookings/[id]/status. `stripeCheckoutSessionId` is written onto
 * the booking at checkout time (src/app/(frontend)/api/checkout/route.ts),
 * i.e. before the webhook fires, so this lookup works even in the brief
 * window between redirect-back and webhook delivery.
 *
 * Same data-minimisation posture as the status endpoint: no PII returned.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json({ error: 'missing_session_id' }, { status: 400 })
  }

  const p = await payload()
  const result = await p.find({
    collection: 'bookings',
    where: { stripeCheckoutSessionId: { equals: sessionId } },
    limit: 1,
    overrideAccess: true,
  })

  const booking = result.docs[0] as { id: string | number; reference: string; status: string } | undefined
  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ id: booking.id, reference: booking.reference, status: booking.status })
}
