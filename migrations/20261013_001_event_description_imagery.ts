import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * 20261013 — Per-event description + hero image.
 *
 * Events gain an optional `description` (Lexical richText, jsonb) and an
 * optional `imagery` upload (FK to media), mirroring the same columns on
 * `services`. Both fall back to the parent service's values when empty.
 *
 * Postgres has no ADD CONSTRAINT IF NOT EXISTS, so the FK is added inside
 * a DO block that swallows duplicate_object, keeping `up` re-runnable.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "description" jsonb;
  ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "imagery_id" integer;
  DO $$ BEGIN
    ALTER TABLE "events" ADD CONSTRAINT "events_imagery_id_media_id_fk" FOREIGN KEY ("imagery_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "events_imagery_idx" ON "events" USING btree ("imagery_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "events_imagery_idx";
  ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_imagery_id_media_id_fk";
  ALTER TABLE "events" DROP COLUMN IF EXISTS "imagery_id";
  ALTER TABLE "events" DROP COLUMN IF EXISTS "description";`)
}
