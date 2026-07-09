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

export async function GET(req: NextRequest) {
  const p = await payload()

  const user = await verifySession(req, p)
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Fetch all coupons (admin only)
  const couponsResult = await p.find({
    collection: 'coupons',
    limit: 500,
    sort: '-createdAt',
    overrideAccess: true,
  })

  const coupons = await Promise.all(
    couponsResult.docs.map(async (doc) => {
      const c = doc as {
        id: string | number
        code: string
        type: string
        value: number
        useCount: number
        maxTotalUses?: number | null
        active: boolean
        validUntil: string
      }

      // Get redemptions for this coupon and sum the total discount
      const redemptionsResult = await p.find({
        collection: 'coupon_redemptions',
        where: { coupon: { equals: c.id } },
        depth: 1,
        limit: 500,
        overrideAccess: true,
      })

      let totalDiscountRedeemed = 0
      for (const r of redemptionsResult.docs) {
        const redemption = r as { booking?: string | number | { totalAmount?: number; coupon?: { type?: string; value?: number } } | null }
        const booking = typeof redemption.booking === 'object' ? redemption.booking : null
        if (booking && booking.totalAmount != null) {
          if (c.type === 'percentage') {
            totalDiscountRedeemed += booking.totalAmount * (c.value / 100)
          } else if (c.type === 'fixed') {
            totalDiscountRedeemed += Math.min(c.value, booking.totalAmount)
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
        validUntil: c.validUntil,
        totalDiscountRedeemed,
        redemptionsCount: redemptionsResult.docs.length,
      }
    }),
  )

  return NextResponse.json({ coupons })
}
