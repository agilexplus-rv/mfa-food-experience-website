import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { getAvailability } from '@/lib/availability'
import { holdDurationMinutes } from '@/lib/env'
import { isEventBookable } from '@/lib/events/auto-close'

/**
 * Seat-hold creation/release per ADR-002.
 *
 * ADR-002's ideal model is a serializable transaction with an
 * event-scoped Postgres advisory lock (`pg_advisory_xact_lock`) around
 * the "compute availability -> insert hold" window. That literal model
 * is not available here: the demo environment runs on Turso/libSQL
 * (no advisory locks) and Payload's Local API does not expose a way to
 * wrap its calls in a caller-controlled transaction that works
 * identically on both adapters.
 *
 * What is implemented instead -- "insert, then verify" (optimistic
 * concurrency), which needs no lock and is race-safe as long as each
 * statement is committed before the next one runs (true for autocommit
 * Local API calls on both adapters):
 *
 *   1. Cheap pre-check: reject immediately when `seats > remaining` so
 *      the common "sold out" path returns an accurate `remaining`.
 *   2. INSERT the hold row.
 *   3. Re-read availability WITH our own hold counted. If
 *      capacity - booked - holds < 0, we lost a race: delete our own
 *      hold and return insufficient_seats.
 *
 * Why this cannot overbook: for two racing requests A and B, each
 * inserts before it re-reads. Whichever re-read happens last sees both
 * rows, so at least one of them (possibly both -- the customer simply
 * retries) backs out. The same pattern is used for the pending booking
 * in /api/checkout and the webhook additionally re-checks capacity
 * before confirming (ADR-004 step 3). Residual risk: a false negative
 * under a genuine simultaneous race (both back out) -- fail-safe, never
 * fail-open.
 *
 * Other deviations from the ADR, unchanged and called out here:
 *   - "One active hold per cart" is enforced in application code
 *     (delete previous holds for sessionId+event before insert) rather
 *     than by a DB partial unique index, since SeatHolds.ts declares
 *     none.
 */

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

export type CreateHoldResult =
  | { ok: true; hold: { id: string | number; expiresAt: string; seats: number; eventId: string | number } }
  | { ok: false; error: 'insufficient_seats'; remaining: number }
  | { ok: false; error: 'event_not_found' }
  | { ok: false; error: 'event_not_bookable' }

export async function createSeatHold(
  eventId: string | number,
  seats: number,
  sessionId: string,
): Promise<CreateHoldResult> {
  const p = await payload()

  const event = await p.findByID({ collection: 'events', id: eventId, overrideAccess: true }).catch(() => null)
  if (!event) return { ok: false, error: 'event_not_found' }
  const evt = event as { date?: string; startTime?: string; autoCloseHoursAfter?: number | null; status?: string }
  if (evt.status !== 'scheduled' || !isEventBookable(evt)) {
    return { ok: false, error: 'event_not_bookable' }
  }

  // Release any previous active hold this session already holds for this
  // event before creating a new one (one active hold per cart/event).
  const now = new Date().toISOString()
  const existing = await p.find({
    collection: 'seat_holds',
    where: {
      and: [
        { event: { equals: eventId } },
        { sessionId: { equals: sessionId } },
        { expiresAt: { greater_than: now } },
      ],
    },
    limit: 10,
    overrideAccess: true,
  })
  for (const doc of existing.docs) {
    await p.delete({ collection: 'seat_holds', id: (doc as { id: string | number }).id, overrideAccess: true })
  }

  // Final availability check immediately before insert (TOCTOU mitigation).
  const availability = await getAvailability(eventId)
  if (seats > availability.remaining) {
    return { ok: false, error: 'insufficient_seats', remaining: availability.remaining }
  }

  const expiresAt = new Date(Date.now() + holdDurationMinutes() * 60_000).toISOString()
  const hold = await p.create({
    collection: 'seat_holds',
    data: { event: eventId, sessionId, seats, expiresAt },
    overrideAccess: true,
  })
  const holdId = (hold as { id: string | number }).id

  // Post-insert verification (see header): re-read with our own hold now
  // counted. A negative balance means a concurrent request won the race.
  const after = await getAvailability(eventId)
  const balance = after.capacity - after.booked - after.holds
  if (balance < 0) {
    await p.delete({ collection: 'seat_holds', id: holdId, overrideAccess: true }).catch(() => undefined)
    return {
      ok: false,
      error: 'insufficient_seats',
      remaining: Math.max(0, after.capacity - after.booked - (after.holds - seats)),
    }
  }

  return {
    ok: true,
    hold: { id: holdId, expiresAt, seats, eventId },
  }
}

/**
 * Release a hold. When `sessionId` is given (always, from the public
 * DELETE endpoint) the hold must belong to that cart: hold ids are
 * sequential integers, so without this check anyone could enumerate and
 * release other visitors' reservations. Server-internal callers (checkout
 * rollback) pass no sessionId.
 */
export async function releaseSeatHold(
  holdId: string | number,
  sessionId?: string,
): Promise<{ ok: boolean; error?: 'forbidden' }> {
  const p = await payload()
  if (sessionId !== undefined) {
    const existing = await getSeatHold(holdId)
    // Already gone (expired + swept, or already released) -- idempotent no-op.
    if (!existing) return { ok: true }
    if (existing.sessionId !== sessionId) return { ok: false, error: 'forbidden' }
  }
  try {
    await p.delete({ collection: 'seat_holds', id: holdId, overrideAccess: true })
    return { ok: true }
  } catch {
    return { ok: true }
  }
}

export async function getSeatHold(
  holdId: string | number,
): Promise<{ id: string | number; event: string | number; sessionId: string; seats: number; expiresAt: string } | null> {
  const p = await payload()
  const doc = await p.findByID({ collection: 'seat_holds', id: holdId, overrideAccess: true }).catch(() => null)
  if (!doc) return null
  const d = doc as { id: string | number; event: string | number | { id: string | number }; sessionId: string; seats: number; expiresAt: string }
  return {
    id: d.id,
    event: typeof d.event === 'object' ? d.event.id : d.event,
    sessionId: d.sessionId,
    seats: d.seats,
    expiresAt: d.expiresAt,
  }
}

/**
 * Sweep all expired holds. Used by the cron endpoint and safe to call
 * anytime.
 *
 * Note on cadence: ADR-002 proposes a 30-second sweeper. This project
 * deploys on Vercel's Hobby-tier account (agilexplus team, confirmed
 * via `vercel teams ls` -- Hobby crons run at most once/day per the
 * platform docs at the time of writing; Pro allows unlimited/minute).
 * vercel.json uses an hourly schedule as a conservative, portable
 * default that works regardless of plan tier. This does NOT weaken
 * correctness: getAvailability() (src/lib/availability.ts) filters
 * seat_holds by `expiresAt > now` at read time, so an unswept expired
 * hold never counts against availability -- the sweeper is table
 * hygiene (preventing unbounded row growth), not a correctness
 * dependency. Upgrade the schedule to every-minute if/when the
 * project moves to Vercel Pro.
 */
export async function sweepExpiredHolds(): Promise<{ deleted: number }> {
  const p = await payload()
  const now = new Date().toISOString()
  const expired = await p.find({
    collection: 'seat_holds',
    where: { expiresAt: { less_than: now } },
    limit: 500,
    overrideAccess: true,
  })
  let deleted = 0
  for (const doc of expired.docs) {
    await p.delete({ collection: 'seat_holds', id: (doc as { id: string | number }).id, overrideAccess: true })
    deleted++
  }
  return { deleted }
}
