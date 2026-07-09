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

/** GET /console/api/events/[id] — get single event */
export async function GET(
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

  try {
    const ev = await p.findByID({
      collection: 'events',
      id,
      depth: 1,
      overrideAccess: true,
    })
    if (!ev) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = ev as any
    return NextResponse.json(e)
  } catch (err) {
    console.error('[console/api/events] Get failed:', err)
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
  }
}

/** PATCH /console/api/events/[id] — update an event */
export async function PATCH(
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
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  try {
    await p.update({
      collection: 'events',
      id,
      data: body,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[console/api/events] Update failed:', err)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
}

/** DELETE /console/api/events/[id] — delete an event (blocks if bookings exist) */
export async function DELETE(
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

  // Check for existing bookings
  try {
    const bookingCount = await p.find({
      collection: 'bookings',
      where: { event: { equals: id } },
      limit: 0,
      overrideAccess: true,
    })
    if (bookingCount.totalDocs > 0) {
      return NextResponse.json({
        error: 'has_bookings',
        message: `Cannot delete: ${bookingCount.totalDocs} booking(s) exist for this event. Cancel or reassign them first.`,
      }, { status: 409 })
    }
  } catch (err) {
    console.error('[console/api/events] Booking check failed:', err)
    return NextResponse.json({ error: 'check_failed' }, { status: 500 })
  }

  try {
    await p.delete({
      collection: 'events',
      id,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[console/api/events] Delete failed:', err)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
}
