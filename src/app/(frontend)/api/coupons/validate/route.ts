import { NextRequest, NextResponse } from 'next/server'

import { validateCouponSchema } from '@/lib/validations/booking'
import { validateCoupon, getEventPricingContext } from '@/lib/coupons/validate'

/**
 * POST /api/coupons/validate -- read-only coupon preview per ADR-005.
 * Never consumes a use; the use-count increment only happens inside
 * the Stripe webhook finalisation sequence (src/lib/bookings/finalize.ts).
 *
 * @compliance C10, C11 (rate limiting noted as a follow-up -- see summary)
 */
export async function POST(req: NextRequest) {
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
