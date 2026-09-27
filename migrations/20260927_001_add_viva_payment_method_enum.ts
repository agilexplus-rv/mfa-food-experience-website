import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * 20260927 — Add 'viva' to the bookings payment_method enum.
 *
 * The Bookings collections's paymentMethod select was updated to include
 * 'viva' (Phase 7 VIVA Wallet), but the PostgreSQL enum created by the
 * initial migration still had only the original five values. INSERTs with
 * payment_method = 'viva' then fail with an invalid-enum-value error.
 *
 * ALTER TYPE ADD VALUE is safe and idempotent in Postgres ≥ 9.1:
 * adding a value that already exists fails with a duplicate error, so
 * we guard with a DO block.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "enum_bookings_payment_method" ADD VALUE 'viva';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // PostgreSQL does not support dropping enum values, so this is a no-op.
  // (Undoing would require recreating the column, which is destructive.)
}