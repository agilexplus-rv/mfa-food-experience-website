import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { getAvailability, getAvailabilityForEvents } from '@/lib/availability'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * GET /api/staff/events?event=ID — list upcoming events and capacity info
 * for door staff (event selector + live capacity counter, Phase 6 scope 3).
 *
 * Without ?event: returns a list of today's and upcoming scheduled events.
 * With ?event=ID: returns capacity details for a single event.
 *
 * @compliance ADR-008 C6 (RBAC: admin + door_staff only), C18.
 */
export async function GET(req: NextRequest) {
  const p = await payload()
  const currentUser = await verifySession(req, p)

  if (!currentUser) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  if (currentUser.role !== 'admin' && currentUser.role !== 'door_staff') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const params = req.nextUrl.searchParams
  const singleEventId = params.get('event')

  if (singleEventId) {
    const avail = await getAvailability(singleEventId)
    // Count how many bookings are checked in for this event
    const checkIns = await p.find({
      collection: 'bookings',
      where: {
        and: [
          { event: { equals: singleEventId } },
          { checkedInAt: { not_equals: null } },
        ],
      },
      limit: 0,
      overrideAccess: true,
    })
    return NextResponse.json({
      eventId: singleEventId,
      capacity: avail.capacity,
      booked: avail.booked,
      remaining: avail.remaining,
      checkedIn: checkIns.totalDocs,
    })
  }

  // List today's and upcoming scheduled events
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  const events = await p.find({
    collection: 'events',
    where: {
      and: [
        { date: { greater_than_equal: startOfToday } },
        { status: { equals: 'scheduled' } },
      ],
    },
    sort: 'date',
    limit: 50,
    overrideAccess: true,
  })

  // Batch load availability for all events
  const eventList = (events.docs as Array<{
    id: string | number; capacity: number; fullyBookedOverride?: boolean;
    title: string; date: string; startTime: string;
  }>).map((e) => ({
    id: e.id, capacity: e.capacity, fullyBookedOverride: e.fullyBookedOverride,
  }))
  const availMap = await getAvailabilityForEvents(eventList)

  // Also batch-load checked-in counts
  const allEventIds = eventList.map((e) => e.id)
  const checkInDocs = await p.find({
    collection: 'bookings',
    where: {
      and: [
        { event: { in: allEventIds } },
        { checkedInAt: { not_equals: null } },
      ],
    },
    limit: 0,
    overrideAccess: true,
  })
  const checkedInByEvent = new Map<string | number, number>()
  for (const b of checkInDocs.docs as Array<{ event?: string | number | { id: string | number } }>) {
    const key = typeof b.event === 'object' ? b.event.id : b.event
    if (key !== undefined) checkedInByEvent.set(key, (checkedInByEvent.get(key) ?? 0) + 1)
  }

  const list = (events.docs as Array<{
    id: string | number; title: string; date: string; startTime: string;
  }>).map((e) => {
    const avail = availMap.get(String(e.id))
    return {
      id: e.id,
      title: e.title,
      date: e.date,
      startTime: e.startTime,
      capacity: avail?.capacity ?? 0,
      booked: avail?.booked ?? 0,
      remaining: avail?.remaining ?? 0,
      checkedIn: checkedInByEvent.get(e.id) ?? 0,
    }
  })

  return NextResponse.json({ events: list })
}
