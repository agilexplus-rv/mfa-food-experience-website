import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Adds a paymentDeadline column to bookings so the system can enforce a
 * 15-minute payment window (match the seat-hold TTL from ADR-002).
 * After the deadline, a booking is cancelled and its seats are freed.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "payment_deadline" timestamptz;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "payment_deadline";`)
}