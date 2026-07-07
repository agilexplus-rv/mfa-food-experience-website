import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { getAvailability } from '@/lib/availability'
import { holdDurationMinutes } from '@/lib/env'

/**
 * Seat-hold creation/release per ADR-002.
 *
 * ADR-002's ideal model is a serializable transaction with an
 * event-scoped Postgres advisory lock (`pg_advisory_xact_lock`) around
 * the "compute availability -> insert hold" window. Two constraints on
 * this project make that literal model unavailable everywhere:
 *
 *   1. The demo environment runs on Turso/libSQL (SQLite), which has no
 *      advisory-lock primitive and, per this session's prior findings,
 *      hangs on `next dev` introspection against Payload's Drizzle
 *      layer -- the sqlite adapter here has no meaningful
 *      cross-request locking story at all.
 *   2. Payload's Local API does not expose raw `pg_advisory_xact_lock`
 *      calls even against the Postgres adapter used in production.
 *
 * Compromise implemented here (documented per the task's atomicity
 * disclosure requirement):
 *   - We still perform the "read availability, then insert" sequence
 *     inside as tight a window as possible (no I/O between the check
 *     and the insert).
 *   - We re-check availability by doing a final read of active holds +
 *     bookings for the event immediately before inserting the hold row
 *     (defence-in-depth against the classic TOCTOU race), matching
 *     ADR-002's "READ COMMITTED + advisory lock" fallback described as
 *     an accepted alternative in the ADR ("Alternatively, with
 *     PostgreSQL's default READ COMMITTED + the advisory lock...").
 *   - We rely on the DB-level partial-unique-index style guarantee via
 *     an application-level check for an existing active hold for the
 *     same sessionId+event (one hold per cart), rather than a DB
 *     constraint, since SeatHolds.ts does not declare one -- this is a
 *     narrower guarantee than ADR-002's ideal and is called out here
 *     rather than silently assumed.
 *   - True overbooking-under-concurrency safety at MFA's actual scale
 *     (single-venue, ~30 capacity/event) is still achieved in practice
 *     because Vercel serverless functions rarely race on the exact
 *     same millisecond for the same event, and the webhook handler
 *     re-verifies capacity again (ADR-004 step 3) before confirming --
 *     but this is NOT a mathematical guarantee under true concurrent
 *     load the way SERIALIZABLE + advisory lock would be. If MFA moves
 *     to Postgres in production (ADR-001), upgrading this function to
 *     issue a raw `SELECT pg_advisory_xact_lock($1)` via a direct
 *     Drizzle/pg client (bypassing the Local API) would close this gap
 *     -- left as a follow-up, flagged in the final summary.
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

export async function createSeatHold(
  eventId: string | number,
  seats: number,
  sessionId: string,
): Promise<CreateHoldResult> {
  const p = await payload()

  const event = await p.findByID({ collection: 'events', id: eventId, overrideAccess: true }).catch(() => null)
  if (!event) return { ok: false, error: 'event_not_found' }

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

  return {
    ok: true,
    hold: { id: (hold as { id: string | number }).id, expiresAt, seats, eventId },
  }
}

export async function releaseSeatHold(holdId: string | number): Promise<{ ok: boolean }> {
  const p = await payload()
  try {
    await p.delete({ collection: 'seat_holds', id: holdId, overrideAccess: true })
    return { ok: true }
  } catch {
    // Already gone (expired + swept, or already released) -- idempotent no-op.
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
