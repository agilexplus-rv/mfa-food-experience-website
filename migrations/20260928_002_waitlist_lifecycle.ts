import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * 20260928 — Waitlist lifecycle + retention setting.
 *
 * - Waitlist: status gains 'converted' (the person booked the event) and
 *   'archived' (admin action on /console/waitlist), plus convertedAt /
 *   archivedAt / expiredAt timestamps.
 * - SiteSettings: waitlistRetentionMonths (required, default 6), read by
 *   POST /console/api/waitlist/cleanup. The column DEFAULT back-fills the
 *   existing settings row, so saving site settings keeps passing the
 *   required check.
 *
 * ADD VALUE IF NOT EXISTS is idempotent; Postgres cannot remove enum
 * values, so `down` only drops the columns.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_waitlist_status" ADD VALUE IF NOT EXISTS 'converted';
  ALTER TYPE "public"."enum_waitlist_status" ADD VALUE IF NOT EXISTS 'archived';
  ALTER TABLE "waitlist" ADD COLUMN IF NOT EXISTS "converted_at" timestamp(3) with time zone;
  ALTER TABLE "waitlist" ADD COLUMN IF NOT EXISTS "archived_at" timestamp(3) with time zone;
  ALTER TABLE "waitlist" ADD COLUMN IF NOT EXISTS "expired_at" timestamp(3) with time zone;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "waitlist_retention_months" numeric DEFAULT 6 NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "waitlist" DROP COLUMN IF EXISTS "converted_at";
  ALTER TABLE "waitlist" DROP COLUMN IF EXISTS "archived_at";
  ALTER TABLE "waitlist" DROP COLUMN IF EXISTS "expired_at";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "waitlist_retention_months";`)
}
