import type { Payload } from 'payload'
import { sql, type SQL } from 'drizzle-orm'

/**
 * Atomic, single-statement writes for the booking/payment engine.
 *
 * Payload's Local API `update` is NOT a single UPDATE statement: it reads
 * the document, merges the incoming data over it (missing fields are
 * back-filled from the stored doc in beforeValidate), then writes the
 * whole row. Two consequences matter for the payment flow:
 *
 *   1. `update({ data: { useCount: c.useCount + 1 } })` is a classic
 *      read-modify-write; two concurrent finalisations for the same coupon
 *      both read N and both write N+1 (lost update).
 *   2. `update({ data: { status: 'cancelled' } })` overwrites whatever
 *      status the row had at the time of Payload's *read*, so it can
 *      revert a concurrent 'confirmed' write (TOCTOU between the cancel
 *      page / webhook / deadline sweep).
 *
 * The helpers here go straight to the Drizzle instance the active adapter
 * exposes (`payload.db.drizzle`) and issue one conditional UPDATE with a
 * RETURNING clause, so the *database* decides the winner. They are
 * deliberately tiny and touch only columns that already exist -- no schema
 * change, no transaction plumbing. Both supported adapters are covered:
 *   - @payloadcms/db-postgres (production): drizzle.execute() -> { rows }
 *   - @payloadcms/db-sqlite / libSQL (demo + local): drizzle.all() -> rows
 *
 * Payload hooks are bypassed for these statements; the only hooks on the
 * affected collections are audit-log hooks that no-op without a req.user,
 * which is always the case on these server-only paths.
 */

type Row = Record<string, unknown>

interface PgDrizzleLike {
  execute(query: SQL): Promise<{ rows?: Row[] }>
}
interface SqliteDrizzleLike {
  all(query: SQL): Promise<Row[]>
}

async function runReturning(p: Payload, statement: SQL): Promise<Row[]> {
  const db = p.db as unknown as { name?: string; drizzle: unknown }
  if (db.name === 'postgres') {
    const res = await (db.drizzle as PgDrizzleLike).execute(statement)
    return res.rows ?? []
  }
  return (db.drizzle as SqliteDrizzleLike).all(statement)
}

/** Payload ids are integer serials on both adapters; coerce numeric strings so SQLite compares as integers. */
function dbId(id: string | number): number | string {
  return typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'checked_in'

/**
 * Compare-and-set on bookings.status. Returns true iff THIS call moved the
 * row from `from` to `to`; false means another writer got there first (or
 * the booking does not exist). Use it as the idempotency / claim primitive
 * for webhook finalisation and for expiring unpaid bookings.
 */
export async function transitionBookingStatus(
  p: Payload,
  bookingId: string | number,
  from: BookingStatus,
  to: BookingStatus,
): Promise<boolean> {
  const now = new Date().toISOString()
  const rows = await runReturning(
    p,
    sql`UPDATE bookings SET status = ${to}, updated_at = ${now} WHERE id = ${dbId(bookingId)} AND status = ${from} RETURNING id`,
  )
  return rows.length > 0
}

/**
 * Atomic `use_count = use_count + 1`, guarded by max_total_uses in the
 * same statement (ADR-005's SELECT ... FOR UPDATE equivalent). Returns
 * false when the coupon is exhausted or missing -- nothing was changed.
 */
export async function incrementCouponUseCount(p: Payload, couponId: string | number): Promise<boolean> {
  const now = new Date().toISOString()
  const rows = await runReturning(
    p,
    sql`UPDATE coupons SET use_count = COALESCE(use_count, 0) + 1, updated_at = ${now} WHERE id = ${dbId(couponId)} AND (max_total_uses IS NULL OR COALESCE(use_count, 0) < max_total_uses) RETURNING id`,
  )
  return rows.length > 0
}
