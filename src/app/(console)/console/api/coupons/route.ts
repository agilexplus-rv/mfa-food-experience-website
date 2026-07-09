import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
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
    const coupon = await p.create({
      collection: 'coupons',
      data: {
        code: body.code || undefined,
        type: body.type,
        value: body.value,
        validFrom: body.validFrom,
        validUntil: body.validUntil,
        maxTotalUses: body.maxTotalUses || undefined,
        maxUsesPerBooking: body.maxUsesPerBooking ?? 1,
        applicableServices: body.applicableServices || undefined,
        active: body.active ?? true,
      },
      overrideAccess: true,
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

  let body: { id?: string | number; active?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  try {
    await p.update({
      collection: 'coupons',
      id: body.id,
      data: { active: body.active },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'update_failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
