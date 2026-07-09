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

/**
 * POST /api/bookings/[id]/no-show
 *
 * Admin-only. Marks a confirmed booking as no-show if the event date
 * has passed and the booking has not been checked in.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const p = await payload()

  const user = await verifySession(req, p)
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const booking = await p
    .findByID({ collection: 'bookings', id, overrideAccess: true, depth: 1 })
    .catch(() => null)

  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const b = booking as {
    id: string | number
    reference: string
    status: string
    checkedInAt: string | null
    noShow: boolean
    event: { id: string | number; date: string } | string | number
  }

  if (b.noShow) {
    return NextResponse.json({ error: 'already_marked_no_show', reference: b.reference }, { status: 409 })
  }

  if (b.status !== 'confirmed') {
    return NextResponse.json({ error: 'only_confirmed_bookings_can_be_marked_no_show' }, { status: 409 })
  }

  if (b.checkedInAt) {
    return NextResponse.json({ error: 'checked_in_bookings_cannot_be_marked_no_show' }, { status: 409 })
  }

  // Check event date has passed
  let eventDate: string | undefined
  if (typeof b.event === 'object') {
    eventDate = b.event.date
  } else {
    const ev = await p.findByID({ collection: 'events', id: b.event as string | number, overrideAccess: true }).catch(() => null)
    eventDate = (ev as { date?: string } | null)?.date
  }

  if (eventDate) {
    const evDate = new Date(eventDate)
    const now = new Date()
    // Set both to start of day for comparison
    evDate.setHours(0, 0, 0, 0)
    now.setHours(0, 0, 0, 0)
    if (evDate >= now) {
      return NextResponse.json(
        { error: 'event_not_past', message: 'Cannot mark no-show for events that have not yet taken place.' },
        { status: 409 },
      )
    }
  }

  await p.update({
    collection: 'bookings',
    id,
    data: { noShow: true },
    overrideAccess: true,
  })

  await p.create({
    collection: 'audit_logs',
    data: {
      action: 'update',
      actor: user.id as string,
      collection: 'bookings',
      documentId: String(id),
      detail: `Marked ${b.reference} as no-show`,
    },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true, reference: b.reference })
}
