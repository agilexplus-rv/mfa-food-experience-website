import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

// The Phase 7 (VIVA Wallet) columns were added to Bookings.ts but their raw
// `003_viva_payment.sql` was never applied to the Postgres DB (the raw SQL
// lives outside Payload's drizzle migration tracking). As a result every
// query against `bookings` failed with 42703 `column "viva_order_code" does
// not exist`. This migration back-fills the three columns idempotently.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "viva_order_code" varchar;
  ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "viva_transaction_id" varchar;
  ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "viva_refund_id" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "bookings" DROP COLUMN IF EXISTS "viva_order_code";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "viva_transaction_id";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "viva_refund_id";`)
}
