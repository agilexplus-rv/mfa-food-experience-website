import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * 20261104 — Official contact address in stored policy content.
 *
 * `foodexperience.mfa@gov.mt` is the Agency's official address. The code
 * defaults and the seed already use it, but the seed skips documents that
 * exist, so policy bodies written before this change still carry the retired
 * bookings@ / info@ addresses — the live Provider Information page is the
 * visible example.
 *
 * Rewrites only those two exact strings, so the migration is idempotent and
 * leaves every other character of the rich text untouched. Globals are not
 * touched: their bodies are empty, so the corrected code default is served.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "policies"
    SET "body" = replace(
          replace("body"::text, 'bookings@foodagency.mt', 'foodexperience.mfa@gov.mt'),
          'info@foodagency.mt', 'foodexperience.mfa@gov.mt'
        )::jsonb
    WHERE "body"::text LIKE '%@foodagency.mt%';
  `)
}

export async function down(): Promise<void> {
  // No-op: this is a content correction, and reverting it would republish a
  // retired address on a live legal page.
}
