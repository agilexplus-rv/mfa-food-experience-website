import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { actingAs } from '@/lib/audit/helper'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * Validate coupon fields. `current` (optional) is the existing doc when
 * the caller is a partial update; the merged view is validated, and in
 * updates only keys that are PRESENT in `input` are checked (an allowlist).
 * Throws Error with a user-facing message; callers return 400 { error }.
 */
function validateCouponFields(
  input: Record<string, unknown>,
  current?: Record<string, unknown> | null,
): void {
  const effective = { ...current, ...input }
  const type = 'type' in input ? input.type : effective.type
  if (type !== 'percentage' && type !== 'fixed') throw new Error('type must be percentage or fixed')

  const value = 'value' in input ? input.value : effective.value
  if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) {
    throw new Error('Value must be a number greater than 0')
  }
  if (type === 'percentage' && Number(value) > 100) throw new Error('Percentage value cannot exceed 100')

  const fromRaw = 'validFrom' in input ? input.validFrom : effective.validFrom
  const untilRaw = 'validUntil' in input ? input.validUntil : effective.validUntil
  const from = typeof fromRaw === 'string' ? fromRaw.slice(0, 10) : ''
  const until = typeof untilRaw === 'string' ? untilRaw.slice(0, 10) : ''
  if (!from || !until) throw new Error('Valid from and valid until dates are required')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    throw new Error('Dates must be YYYY-MM-DD')
  }
  if (until < from) throw new Error('Valid until cannot be before valid from')

  const maxTotal = 'maxTotalUses' in input ? input.maxTotalUses : effective.maxTotalUses
  if (maxTotal != null && maxTotal !== '') {
    const n = Number(maxTotal)
    if (!Number.isInteger(n) || n < 1) throw new Error('Max total uses must be a whole number of 1 or more')
  }

  const perBooking = 'maxUsesPerBooking' in input ? input.maxUsesPerBooking : effective.maxUsesPerBooking
  if (perBooking != null) {
    const n = Number(perBooking)
    if (!Number.isInteger(n) || n < 1) throw new Error('Max uses per booking must be a whole number of 1 or more')
  }

  if ('active' in input && typeof input.active !== 'boolean') throw new Error('active must be a boolean')
}

async function auth(req: NextRequest): Promise<{ id: string | number; email: string; role: string } | null> {
  const p = await payload()
  const user = await verifySession(req, p)
  if (!user || user.role !== 'admin') return null
  return user
}

export async function GET(req: NextRequest) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const p = await payload()

  const couponsResult = await p.find({
    collection: 'coupons',
    limit: 500,
    sort: '-createdAt',
    overrideAccess: true,
  })

  const coupons = await Promise.all(
    couponsResult.docs.map(async (doc) => {
      const c = doc as Record<string, unknown>

      const redemptionsResult = await p.find({
        collection: 'coupon_redemptions',
        where: { coupon: { equals: c.id } },
        depth: 1,
        limit: 500,
        overrideAccess: true,
      })

      let totalDiscountRedeemed = 0
      for (const r of redemptionsResult.docs) {
        const redemption = r as Record<string, unknown>
        const booking = typeof redemption.booking === 'object' && redemption.booking !== null
          ? (redemption.booking as Record<string, unknown>)
          : null
        if (booking && booking.totalAmount != null) {
          if (c.type === 'percentage') {
            totalDiscountRedeemed += Number(booking.totalAmount) * (Number(c.value) / 100)
          } else if (c.type === 'fixed') {
            totalDiscountRedeemed += Math.min(Number(c.value), Number(booking.totalAmount))
          }
        }
      }

      return {
        id: c.id,
        code: c.code,
        type: c.type,
        value: c.value,
        useCount: c.useCount,
        maxTotalUses: c.maxTotalUses ?? null,
        active: c.active,
        validFrom: c.validFrom || null,
        validUntil: c.validUntil,
        applicableServices: c.applicableServices || null,
        maxUsesPerBooking: c.maxUsesPerBooking ?? 1,
        totalDiscountRedeemed,
        redemptionsCount: redemptionsResult.docs.length,
      }
    }),
  )

  return NextResponse.json({ coupons })
}

export async function POST(req: NextRequest) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const p = await payload()

  let body: {
    code?: string; type?: string; value?: number
    validFrom?: string; validUntil?: string
    maxTotalUses?: number | null; maxUsesPerBooking?: number
    applicableServices?: (string | number)[]; active?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!body.type || body.value == null || !body.validFrom || !body.validUntil) {
    return NextResponse.json({ error: 'type, value, validFrom, validUntil are required' }, { status: 400 })
  }

  if (body.type !== 'percentage' && body.type !== 'fixed') {
    return NextResponse.json({ error: 'type must be percentage or fixed' }, { status: 400 })
  }

  try {
    validateCouponFields({ ...body, value: body.value })

    const coupon = await p.create({
      collection: 'coupons',
      data: {
        code: body.code || undefined,
        type: body.type,
        value: body.value,
        validFrom: body.validFrom.slice(0, 10),
        validUntil: body.validUntil.slice(0, 10),
        maxTotalUses: body.maxTotalUses || undefined,
        maxUsesPerBooking: body.maxUsesPerBooking ?? 1,
        applicableServices: body.applicableServices?.map(Number) || undefined,
        active: body.active ?? true,
      },
      overrideAccess: true,
      ...actingAs(currentUser, req),
    })

    const c = coupon as { code?: string }
    return NextResponse.json({ ok: true, id: String(coupon.id), code: c.code }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'create_failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const p = await payload()

  let body: {
    id?: string | number; code?: string; type?: string; value?: number
    validFrom?: string; validUntil?: string
    maxTotalUses?: number | null; maxUsesPerBooking?: number; active?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  try {
    const current = (await p.findByID({ collection: 'coupons', id: Number(body.id), overrideAccess: true }).catch(
      () => null,
    )) as Record<string, unknown> | null
    if (!current) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if ('type' in body) data.type = body.type
    if ('value' in body) data.value = body.value
    if ('validFrom' in body) data.validFrom = typeof body.validFrom === 'string' ? body.validFrom.slice(0, 10) : body.validFrom
    if ('validUntil' in body) data.validUntil = typeof body.validUntil === 'string' ? body.validUntil.slice(0, 10) : body.validUntil
    if ('maxUsesPerBooking' in body) data.maxUsesPerBooking = body.maxUsesPerBooking
    if ('active' in body) data.active = body.active
    if ('maxTotalUses' in body) {
      // null / '' / 0 clears the limit (unlimited); otherwise validate
      if (body.maxTotalUses == null || (body.maxTotalUses as unknown) === '' || Number(body.maxTotalUses) === 0) {
        data.maxTotalUses = null
      } else {
        data.maxTotalUses = Number(body.maxTotalUses)
      }
    }
    if ('code' in body) {
      const code = String(body.code ?? '').trim()
      if (!code) return NextResponse.json({ error: 'Coupon code cannot be empty' }, { status: 400 })
      if (code !== String(current.code ?? '').trim()) data.code = code
    }

    validateCouponFields(body, current)

    await p.update({
      collection: 'coupons',
      id: Number(body.id),
      data,
      overrideAccess: true,
      ...actingAs(currentUser, req),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'update_failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
