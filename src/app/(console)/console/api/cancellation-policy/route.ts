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
  try {
    const policy = await p.findGlobal({
      slug: 'cancellation-policy',
      overrideAccess: true,
    })
    return NextResponse.json({ policy })
  } catch (err) {
    console.error('[console/api/cancellation-policy] Fetch failed:', err)
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
  }
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

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  // Normalise the console payload: new tier rows arrive with id "" (let
  // Payload assign one) and numeric inputs may arrive as strings.
  const data: Record<string, unknown> = { ...body }
  if (Array.isArray(body.tiers)) {
    data.tiers = (body.tiers as Record<string, unknown>[]).map((t) => ({
      ...(t.id ? { id: String(t.id) } : {}),
      minDaysBeforeEvent: Number(t.minDaysBeforeEvent) || 0,
      refundPercentage: Math.min(100, Math.max(0, Number(t.refundPercentage) || 0)),
      label: typeof t.label === 'string' ? t.label : '',
    }))
  }
  if ('coolingOffEnabled' in body) data.coolingOffEnabled = Boolean(body.coolingOffEnabled)
  if ('coolingOffHours' in body) {
    const h = Number(body.coolingOffHours)
    if (data.coolingOffEnabled && (!Number.isFinite(h) || h < 1 || h > 336)) {
      return NextResponse.json({ error: 'Cooling-off period must be between 1 and 336 hours.' }, { status: 400 })
    }
    data.coolingOffHours = Number.isFinite(h) && h >= 1 ? Math.min(336, h) : 24
  }

  try {
    const updated = await p.updateGlobal({
      slug: 'cancellation-policy',
      data,
      overrideAccess: true,
      ...actingAs(currentUser, req),
    })
    return NextResponse.json({ ok: true, policy: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'update_failed'
    console.error('[console/api/cancellation-policy] Update failed:', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
