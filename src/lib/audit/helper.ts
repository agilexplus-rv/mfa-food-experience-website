import type { Payload } from 'payload'

/**
 * Audit log helper — fire-and-forget audit entry creation.
 *
 * Each call is a best-effort write; failure is logged but never blocks
 * the primary operation. We don't await the Promise so the audit_log
 * insert runs outside any enclosing Drizzle transaction (which would
 * hang on Azure Postgres — see Users.ts auth config).
 */

interface AuditInput {
  action: string
  actor?: string | number
  collection: string
  documentId: string | number
  detail: string
  ipAddress?: string
  userAgent?: string
  changes?: Record<string, unknown> | null
}

/**
 * Fire-and-forget audit log entry. The caller must NOT await the result.
 */
export function auditLog(
  payload: Payload,
  input: AuditInput,
): void {
  void (async () => {
    try {
      await payload.create({
        collection: 'audit_logs',
        overrideAccess: true,
        data: {
          action: input.action,
          actor: input.actor,
          collection: input.collection,
          documentId: String(input.documentId),
          detail: input.detail,
          ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
          ...(input.userAgent ? { userAgent: input.userAgent } : {}),
          ...(input.changes ? { changes: input.changes } : {}),
        },
      })
    } catch (err) {
      console.error('[AuditLog] Failed to write entry:', err)
    }
  })()
}

/**
 * Compute a simplified changes diff for audit purposes.
 * Returns only the fields that differ between old and new values.
 */
export function diffChanges(
  oldDoc: Record<string, unknown>,
  newData: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> | null {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of Object.keys(newData)) {
    const oldVal = oldDoc[key]
    const newVal = newData[key]
    if (oldVal !== newVal && key !== 'updatedAt') {
      changes[key] = { from: oldVal, to: newVal }
    }
  }
  return Object.keys(changes).length > 0 ? changes : null
}