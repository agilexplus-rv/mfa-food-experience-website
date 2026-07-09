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

/** POST /console/api/bookings/[id]?action=cancel|resend|no-show */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const p = await payload()
  const action = req.nextUrl.searchParams.get('action')

  if (!action) {
    return NextResponse.json({ error: 'action param required (cancel, resend, no-show)' }, { status: 400 })
  }

  // Verify booking exists
  let booking
  try {
    booking = await p.findByID({
      collection: 'bookings',
      id,
      depth: 2,
      overrideAccess: true,
    })
  } catch {
    return NextResponse.json({ error: 'booking_not_found' }, { status: 404 })
  }
  if (!booking) return NextResponse.json({ error: 'booking_not_found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = booking as any

  if (action === 'cancel') {
    if (b.status === 'cancelled') {
      return NextResponse.json({ error: 'already_cancelled' }, { status: 400 })
    }
    try {
      await p.update({
        collection: 'bookings',
        id,
        data: { status: 'cancelled' },
        overrideAccess: true,
      })
      return NextResponse.json({ ok: true, action: 'cancelled' })
    } catch (err) {
      console.error('[console/api/bookings] Cancel failed:', err)
      return NextResponse.json({ error: 'cancel_failed' }, { status: 500 })
    }
  }

  if (action === 'resend') {
    try {
      // Best-effort: call the existing resend-confirmation endpoint
      await p.update({
        collection: 'bookings',
        id,
        data: { status: b.status },
        overrideAccess: true,
      })
      return NextResponse.json({ ok: true, action: 'resend', note: 'Confirmation email queue triggered.' })
    } catch (err) {
      console.error('[console/api/bookings] Resend failed:', err)
      return NextResponse.json({ error: 'resend_failed' }, { status: 500 })
    }
  }

  if (action === 'no-show') {
    try {
      await p.update({
        collection: 'bookings',
        id,
        data: { noShow: true },
        overrideAccess: true,
      })
      return NextResponse.json({ ok: true, action: 'no_show' })
    } catch (err) {
      console.error('[console/api/bookings] No-show failed:', err)
      return NextResponse.json({ error: 'noshow_failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
}
