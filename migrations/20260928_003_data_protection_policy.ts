import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * 20260928 — DataProtectionPolicy: new global table.
 *
 * No row is inserted: until the policy is first saved (Settings → Data
 * Protection Policy in the console), Payload serves the field defaults,
 * i.e. the drafted policy from src/lib/policies/dataProtectionDefault.ts.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "data_protection_policy" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Data Protection Policy',
  	"body" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "data_protection_policy";`)
}
