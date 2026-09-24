import { NextRequest, NextResponse } from 'next/server'

import { createHoldSchema } from '@/lib/validations/booking'
import { createSeatHold } from '@/lib/bookings/seat-holds'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'

/**
 * POST /api/holds -- create a seat hold per ADR-002.
 *
 * Body: { eventId, seats, sessionId }
 * Returns: { hold: { id, expiresAt, seats, eventId } } on success, or a
 * 409 with { error: 'insufficient_seats', remaining } when the requested
 * seat count exceeds current availability.
 *
 * @compliance ADR-008 C11 (rate limiting on booking endpoints).
 */

// 60 s window, 20 req/min per IP. A real booking flow calls this once per
// seat-selection attempt; a user browsing dates / adjusting seat counts
// rarely exceeds a handful of retries inside a minute. 20 is generous for
// legitimate use while blocking a flood of hold requests (each of which
// reserves seats and writes to the seat-hold store).
const rateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 })

export async function POST(req: NextRequest) {
  rateLimiter.maybeCleanup()

  const ip = getClientIp(req)
  if (!rateLimiter.check(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = createHoldSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { eventId, seats, sessionId } = parsed.data
  const result = await createSeatHold(eventId, seats, sessionId)

  if (!result.ok) {
    if (result.error === 'event_not_found') {
      return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'insufficient_seats', remaining: result.remaining }, { status: 409 })
  }

  return NextResponse.json({ hold: result.hold }, { status: 201 })
}
