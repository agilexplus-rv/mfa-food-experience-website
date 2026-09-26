import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * 20260926 – 11 client changes migration
 *
 * - Events: autoCloseHoursAfter column
 * - CancellationPolicy: coolingOffEnabled + coolingOffHours columns
 * - Bookings: termsAccepted column
 * - AuditLog: ipAddress, userAgent, changes columns
 * - TermsAndConditions: new global table
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Events: auto-close hours after endTime
    ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "auto_close_hours_after" numeric;

    -- CancellationPolicy: voluntary cooling-off period
    ALTER TABLE "cancellation_policy" ADD COLUMN IF NOT EXISTS "cooling_off_enabled" boolean DEFAULT false;
    ALTER TABLE "cancellation_policy" ADD COLUMN IF NOT EXISTS "cooling_off_hours" numeric;

    -- Bookings: T&Cs acceptance
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "terms_accepted" boolean DEFAULT false;

    -- AuditLog: enhanced fields
    ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "ip_address" text;
    ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "user_agent" text;
    ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "changes" jsonb;

    -- TermsAndConditions: new global table
    CREATE TABLE IF NOT EXISTS "terms_and_conditions" (
      "id" serial PRIMARY KEY,
      "title" text,
      "body" jsonb,
      "booking_checkbox_label" text,
      "email_summary" text,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "events" DROP COLUMN IF EXISTS "auto_close_hours_after";
    ALTER TABLE "cancellation_policy" DROP COLUMN IF EXISTS "cooling_off_enabled";
    ALTER TABLE "cancellation_policy" DROP COLUMN IF EXISTS "cooling_off_hours";
    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "terms_accepted";
    ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "ip_address";
    ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "user_agent";
    ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "changes";
    DROP TABLE IF EXISTS "terms_and_conditions";
  `)
}