import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * 20261104 — Add TikTok, YouTube and LinkedIn to the social platform enum.
 *
 * The SocialMediaSettings select gained three platforms so the Agency can
 * publish all five of its pages. The Postgres enum created by the initial
 * migration still holds only ('instagram','facebook','x'), and the adapter's
 * `push` is ignored in production (see @payloadcms/db-postgres connect.js),
 * so saving a TikTok row would fail with an invalid-enum-value error even
 * though the field validates.
 *
 * ALTER TYPE ADD VALUE has no IF NOT EXISTS, so each value is guarded.
 * (Same pattern as 20260927_001_add_viva_payment_method_enum.ts.)
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "enum_social_media_settings_platforms_platform" ADD VALUE 'tiktok';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "enum_social_media_settings_platforms_platform" ADD VALUE 'youtube';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "enum_social_media_settings_platforms_platform" ADD VALUE 'linkedin';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down(): Promise<void> {
  // PostgreSQL cannot remove enum values without recreating the type, which
  // would rewrite the column. Left as a no-op, as in the VIVA enum migration.
}
