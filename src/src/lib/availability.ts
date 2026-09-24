import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import type { AvailabilityStatus, EventAvailability, EventDoc } from './availability-types'

export type { AvailabilityStatus, EventAvailability, EventDoc } from './availability-types'
export { formatPrice } from './availability-types'

/**
 * Availability query helpers for the public service/event pages. SERVER-ONLY.
 *
 * FR-2.3 / FR-2.4 — remaining seats = capacity − booked − active holds.
 *   - "booked"  = sum of `persons` across counted booking statuses for the event
 *   - "holds"   = sum of `seats` across seat_holds whose `expiresAt` is in the future
 *   - A `fullyBookedOverride` on the event forces remaining = 0 (FR-2.5)
 *
 * Booking statuses counted toward "booked": pending, confirmed, checked_in.
 * Cancelled bookings free their seats. Checked-in bookings still occupy a seat.
 */

const COUNTED_STATUSES = ['pending', 'confirmed', 'checked_in']

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

function deriveStatus(remaining: number, capacity: number): AvailabilityStatus {
  if (remaining <= 0) return 'fully_booked'
  if (remaining <= Math.max(1, Math.round(capacity * 0.2))) return 'limited'
  return 'available'
}

export async function getAvailability(eventId: string | number): Promise<EventAvailability> {
  const p = await payload()

  const bookedDocs = await p.find({
    collection: 'bookings',
    where: { and: [{ event: { equals: eventId } }, { status: { in: COUNTED_STATUSES } }] },
    limit: 0,
    overrideAccess: true,
  })
  const booked = (bookedDocs.docs as { persons?: number }[]).reduce((s, b) => s + (b.persons ?? 0), 0)

  const now = new Date().toISOString()
  const holdDocs = await p.find({
    collection: 'seat_holds',
    where: { and: [{ event: { equals: eventId } }, { expiresAt: { greater_than: now } }] },
    limit: 0,
    overrideAccess: true,
  })
  const holds = (holdDocs.docs as { seats?: number }[]).reduce((s, h) => s + (h.seats ?? 0), 0)

  const eventDoc = (await p.findByID({ collection: 'events', id: eventId, overrideAccess: true })) as EventDoc

  const capacity = eventDoc.capacity ?? 0
  const override = Boolean(eventDoc.fullyBookedOverride)
  const remaining = override ? 0 : Math.max(0, capacity - booked - holds)

  return { remaining, capacity, booked, holds, override, status: deriveStatus(remaining, capacity) }
}

export async function getAvailabilityForEvents(
  events: { id: string | number; capacity: number; fullyBookedOverride?: boolean }[],
): Promise<Map<string, EventAvailability>> {
  const out = new Map<string, EventAvailability>()
  if (events.length === 0) return out

  const p = await payload()
  const ids = events.map((e) => e.id)
  const now = new Date().toISOString()

  const bookedDocs = await p.find({
    collection: 'bookings',
    where: { and: [{ event: { in: ids } }, { status: { in: COUNTED_STATUSES } }] },
    limit: 0,
    overrideAccess: true,
  })
  const bookedByEvent = new Map<string | number, number>()
  for (const b of bookedDocs.docs as { event?: string | number | { id: string | number }; persons?: number }[]) {
    const key = typeof b.event === 'object' ? b.event.id : b.event
    if (key === undefined) continue
    bookedByEvent.set(key, (bookedByEvent.get(key) ?? 0) + (b.persons ?? 0))
  }

  const holdDocs = await p.find({
    collection: 'seat_holds',
    where: { and: [{ event: { in: ids } }, { expiresAt: { greater_than: now } }] },
    limit: 0,
    overrideAccess: true,
  })
  const holdsByEvent = new Map<string | number, number>()
  for (const h of holdDocs.docs as { event?: string | number | { id: string | number }; seats?: number }[]) {
    const key = typeof h.event === 'object' ? h.event.id : h.event
    if (key === undefined) continue
    holdsByEvent.set(key, (holdsByEvent.get(key) ?? 0) + (h.seats ?? 0))
  }

  for (const e of events) {
    const booked = bookedByEvent.get(e.id) ?? 0
    const holds = holdsByEvent.get(e.id) ?? 0
    const override = Boolean(e.fullyBookedOverride)
    const remaining = override ? 0 : Math.max(0, e.capacity - booked - holds)
    out.set(String(e.id), { remaining, capacity: e.capacity, booked, holds, override, status: deriveStatus(remaining, e.capacity) })
  }
  return out
}
