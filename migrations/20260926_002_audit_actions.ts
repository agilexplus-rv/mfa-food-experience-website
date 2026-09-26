import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * AuditLog action enum back-fill.
 *
 * The init migration created enum_audit_logs_action with only 8 values,
 * but the AuditLog collection also declares 'cancel' and 'duplicate', and
 * now 'login_failed' and 'password_change' for security auditing. Any
 * insert using a value missing from the Postgres enum fails with 22P02,
 * which (being fire-and-forget) silently drops the audit entry.
 *
 * ADD VALUE IF NOT EXISTS is idempotent; Postgres cannot remove enum
 * values, so `down` is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_audit_logs_action" ADD VALUE IF NOT EXISTS 'login_failed';
  ALTER TYPE "public"."enum_audit_logs_action" ADD VALUE IF NOT EXISTS 'password_change';
  ALTER TYPE "public"."enum_audit_logs_action" ADD VALUE IF NOT EXISTS 'cancel';
  ALTER TYPE "public"."enum_audit_logs_action" ADD VALUE IF NOT EXISTS 'duplicate';`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Postgres does not support dropping enum values; nothing to undo.
}
