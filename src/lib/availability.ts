import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

/**
 * Availability query helpers for the public service/event pages.
 *
 * FR-2.3 / FR-2.4 — remaining seats = capacity − booked − active holds.
 *   - "booked"  = sum of `persons` across counted booking statuses for the event
 *   - "holds"   = sum of `seats` across seat_holds whose `expiresAt` is in the future
 *   - A `fullyBookedOverride` on the event forces remaining = 0 (FR-2.5)
 *   - "Fully booked" is shown when remaining <= 0
 *
 * Booking statuses counted toward "booked": pending, confirmed, checked_in.
 * Cancelled bookings free their seats. Checked-in bookings still occupy
 * a seat (the person showed up), so they remain in the booked sum.
 *
 * These run server-side via the Payload Local API. `getPayload` is
 * idempotent within a request, so re-calling it is cheap.
 */

export type AvailabilityStatus = 'available' | 'limited' | 'fully_booked'

export interface EventAvailability {
  /** Seats still bookable: capacity − booked − active holds (≥0). */
  remaining: number
  /** Total event capacity. */
  capacity: number
  /** Counted booked seats (pending + confirmed + checked_in). */
  booked: number
  /** Active (unexpired) held seats. */
  holds: number
  /** Manual override — when true the event is fully booked regardless of math. */
  override: boolean
  /** Derived status for UI badges. */
  status: AvailabilityStatus
}

/** Loose event shape from the Local API (no generated types committed yet). */
export interface EventDoc {
  id: string | number
  title: string
  date: string
  startTime: string
  endTime: string
  capacity: number
  pricePerPerson: number
  locationRef: string
  status: 'scheduled' | 'cancelled' | 'completed'
  fullyBookedOverride?: boolean
  service?: string | number | { id: string | number }
}

const COUNTED_STATUSES = ['pending', 'confirmed', 'checked_in']

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

function deriveStatus(
  remaining: number,
  capacity: number,
): AvailabilityStatus {
  if (remaining <= 0) return 'fully_booked'
  // "limited" when ≤ 20% of capacity left (and at least 1 seat).
  if (remaining <= Math.max(1, Math.round(capacity * 0.2))) return 'limited'
  return 'available'
}

/**
 * Compute availability for a single event.
 */
export async function getAvailability(
  eventId: string | number,
): Promise<EventAvailability> {
  const p = await payload()

  const bookedDocs = await p.find({
    collection: 'bookings',
    where: {
      and: [
        { event: { equals: eventId } },
        { status: { in: COUNTED_STATUSES } },
      ],
    },
    limit: 0,
    overrideAccess: true,
  })
  const booked = (bookedDocs.docs as { persons?: number }[]).reduce(
    (sum, b) => sum + (b.persons ?? 0),
    0,
  )

  const now = new Date().toISOString()
  const holdDocs = await p.find({
    collection: 'seat_holds',
    where: {
      and: [
        { event: { equals: eventId } },
        { expiresAt: { greater_than: now } },
      ],
    },
    limit: 0,
    overrideAccess: true,
  })
  const holds = (holdDocs.docs as { seats?: number }[]).reduce(
    (sum, h) => sum + (h.seats ?? 0),
    0,
  )

  const eventDoc = (await p.findByID({
    collection: 'events',
    id: eventId,
    overrideAccess: true,
  })) as EventDoc

  const capacity = eventDoc.capacity ?? 0
  const override = Boolean(eventDoc.fullyBookedOverride)
  const rawRemaining = capacity - booked - holds
  const remaining = override ? 0 : Math.max(0, rawRemaining)

  return {
    remaining,
    capacity,
    booked,
    holds,
    override,
    status: deriveStatus(remaining, capacity),
  }
}

/**
 * Batch availability for a list of events — fewer round-trips than
 * calling `getAvailability` per event. Returns a map of String(eventId) → availability.
 *
 * Pass already-fetched event docs (with capacity + override) to avoid
 * re-fetching each event by ID.
 */
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
    where: {
      and: [
        { event: { in: ids } },
        { status: { in: COUNTED_STATUSES } },
      ],
    },
    limit: 0,
    overrideAccess: true,
  })
  const bookedByEvent = new Map<string | number, number>()
  for (const b of bookedDocs.docs as {
    event?: string | number | { id: string | number }
    persons?: number
  }[]) {
    const key = typeof b.event === 'object' ? b.event.id : b.event
    if (key === undefined) continue
    bookedByEvent.set(key, (bookedByEvent.get(key) ?? 0) + (b.persons ?? 0))
  }

  const holdDocs = await p.find({
    collection: 'seat_holds',
    where: {
      and: [
        { event: { in: ids } },
        { expiresAt: { greater_than: now } },
      ],
    },
    limit: 0,
    overrideAccess: true,
  })
  const holdsByEvent = new Map<string | number, number>()
  for (const h of holdDocs.docs as {
    event?: string | number | { id: string | number }
    seats?: number
  }[]) {
    const key = typeof h.event === 'object' ? h.event.id : h.event
    if (key === undefined) continue
    holdsByEvent.set(key, (holdsByEvent.get(key) ?? 0) + (h.seats ?? 0))
  }

  for (const e of events) {
    const booked = bookedByEvent.get(e.id) ?? 0
    const holds = holdsByEvent.get(e.id) ?? 0
    const override = Boolean(e.fullyBookedOverride)
    const rawRemaining = e.capacity - booked - holds
    const remaining = override ? 0 : Math.max(0, rawRemaining)
    out.set(String(e.id), {
      remaining,
      capacity: e.capacity,
      booked,
      holds,
      override,
      status: deriveStatus(remaining, e.capacity),
    })
  }
  return out
}

/** Format a price in EUR per the brand's Malta context. */
export function formatPrice(perPerson: number): string {
  return new Intl.NumberFormat('en-MT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(perPerson)
}
