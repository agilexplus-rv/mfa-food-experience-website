import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

/**
 * Coupon validation per ADR-005. This module is READ-ONLY / preview --
 * it never consumes a use. The use-count increment + redemption record
 * only happen inside the webhook handler's finalisation sequence
 * (src/lib/bookings/finalize.ts), approximating the serializable
 * transaction described in ADR-005 as closely as Payload's Local API
 * allows.
 *
 * @compliance C10, FR-3.2 -- see docs/adr/ADR-005-coupon-atomicity.md
 */

export type CouponValidationError =
  | 'not_found'
  | 'inactive'
  | 'not_yet_valid'
  | 'expired'
  | 'exhausted'
  | 'not_applicable_to_service'

export interface CouponValidationResult {
  ok: boolean
  error?: CouponValidationError
  coupon?: {
    id: string | number
    code: string
    type: 'percentage' | 'fixed'
    value: number
  }
  /** Discount amount in the same unit as event price (whole EUR here, matching pricePerPerson). */
  discountAmount?: number
  totalBeforeDiscount?: number
  totalAfterDiscount?: number
}

interface CouponDoc {
  id: string | number
  code: string
  type: 'percentage' | 'fixed'
  value: number
  validFrom: string
  validUntil: string
  maxTotalUses?: number
  maxUsesPerBooking?: number
  applicableServices?: (string | number | { id: string | number })[]
  active: boolean
  useCount: number
}

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

export async function findActiveCouponByCode(code: string): Promise<CouponDoc | null> {
  const p = await payload()
  const res = await p.find({
    collection: 'coupons',
    where: { code: { equals: code.trim() } },
    limit: 1,
    overrideAccess: true,
  })
  if (res.docs.length === 0) return null
  return res.docs[0] as unknown as CouponDoc
}

/**
 * Validate a coupon code against an event/seats combination and compute
 * the discount. Does NOT mutate the coupon -- safe to call repeatedly
 * (e.g. from the /api/coupons/validate preview endpoint).
 */
export async function validateCoupon(
  code: string,
  eventId: string | number,
  seats: number,
  pricePerPerson: number,
  serviceId: string | number,
): Promise<CouponValidationResult> {
  const coupon = await findActiveCouponByCode(code)
  if (!coupon) return { ok: false, error: 'not_found' }
  if (!coupon.active) return { ok: false, error: 'inactive' }

  const now = new Date()
  const validFrom = new Date(coupon.validFrom)
  const validUntil = new Date(coupon.validUntil)
  if (now < validFrom) return { ok: false, error: 'not_yet_valid' }
  if (now > validUntil) return { ok: false, error: 'expired' }

  if (coupon.maxTotalUses != null && coupon.useCount >= coupon.maxTotalUses) {
    return { ok: false, error: 'exhausted' }
  }

  if (coupon.applicableServices && coupon.applicableServices.length > 0) {
    const ids = coupon.applicableServices.map((s) => (typeof s === 'object' ? s.id : s))
    const applies = ids.some((id) => String(id) === String(serviceId))
    if (!applies) return { ok: false, error: 'not_applicable_to_service' }
  }

  const totalBeforeDiscount = pricePerPerson * seats
  let discountAmount: number
  if (coupon.type === 'percentage') {
    discountAmount = Math.round(totalBeforeDiscount * (coupon.value / 100) * 100) / 100
  } else {
    discountAmount = coupon.value
  }
  // Cap discount at the total (ADR-005 neutral consequence: min charge EUR 0.00)
  discountAmount = Math.min(discountAmount, totalBeforeDiscount)
  const totalAfterDiscount = Math.max(0, totalBeforeDiscount - discountAmount)

  return {
    ok: true,
    coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value },
    discountAmount,
    totalBeforeDiscount,
    totalAfterDiscount,
  }
}

/** eventId helper: fetch the event's service id + price, needed by validateCoupon. */
export async function getEventPricingContext(
  eventId: string | number,
): Promise<{ pricePerPerson: number; serviceId: string | number } | null> {
  const p = await payload()
  const event = (await p.findByID({ collection: 'events', id: eventId, overrideAccess: true }).catch(() => null)) as
    | { pricePerPerson: number; service: string | number | { id: string | number } }
    | null
  if (!event) return null
  const serviceId = typeof event.service === 'object' ? event.service.id : event.service
  return { pricePerPerson: event.pricePerPerson, serviceId }
}
