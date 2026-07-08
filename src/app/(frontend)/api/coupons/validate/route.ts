import { NextRequest, NextResponse } from 'next/server'

import { validateCouponSchema } from '@/lib/validations/booking'
import { validateCoupon, getEventPricingContext } from '@/lib/coupons/validate'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'

/**
 * POST /api/coupons/validate -- read-only coupon preview per ADR-005.
 * Never consumes a use; the use-count increment only happens inside
 * the Stripe webhook finalisation sequence (src/lib/bookings/finalize.ts).
 *
 * @compliance C10, C11 (rate limiting on coupon endpoint).
 */

// 60 s window, 30 req/min per IP. This endpoint is read-only and cheap, so a
// user legitimately trying several coupon codes needs headroom; 30/min lets
// a real user try ~30 codes (far more than typical) while still blocking
// systematic brute-force enumeration of the coupon code space.
const rateLimiter = createRateLimiter({ windowMs: 60_000, max: 30 })

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

  const parsed = validateCouponSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { code, eventId, seats } = parsed.data
  const ctx = await getEventPricingContext(eventId)
  if (!ctx) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }

  const result = await validateCoupon(code, eventId, seats, ctx.pricePerPerson, ctx.serviceId)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 })
  }

  return NextResponse.json(result, { status: 200 })
}
