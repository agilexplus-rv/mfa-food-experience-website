import type { Payload, PayloadRequest } from 'payload'

/**
 * Audit log helper — fire-and-forget audit entry creation.
 *
 * Each call is a best-effort write; failure is logged but never blocks
 * the primary operation. We don't await the Promise so the audit_log
 * insert runs outside any enclosing Drizzle transaction (which would
 * hang on Azure Postgres — see Users.ts auth config).
 */

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'password_change'
  | 'check_in'
  | 'mfa_reset'
  | 'cancel'
  | 'duplicate'

interface AuditInput {
  action: AuditAction
  actor?: string | number
  collection: string
  documentId: string | number
  detail: string
  ipAddress?: string
  userAgent?: string
  changes?: Record<string, unknown> | null
}

/** Context keys used to carry the originating HTTP request's metadata into Local API hooks. */
export interface AuditRequestContext {
  [key: string]: unknown
  auditIp?: string
  auditUserAgent?: string
}

/** Fields that must never be written into the audit `changes` diff. */
const REDACTED_KEYS = new Set([
  'password',
  'hash',
  'salt',
  'totpSecret',
  'resetPasswordToken',
  'resetPasswordExpiration',
  'sessions',
  'qrTokenHash',
])

/**
 * Fire-and-forget audit log entry. The caller must NOT await the result.
 *
 * Entries without an actor are skipped: `audit_logs.actor_id` is NOT NULL,
 * so automated/system writes (cron jobs, webhooks) can't be attributed.
 */
export function auditLog(
  payload: Payload,
  input: AuditInput,
): void {
  const actor = normaliseId(input.actor)
  if (actor === undefined) return
  void (async () => {
    try {
      await payload.create({
        collection: 'audit_logs',
        overrideAccess: true,
        data: {
          action: input.action,
          actor,
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
 * Postgres uses integer PKs and Drizzle rejects numeric strings for
 * integer columns, so coerce "12" -> 12 (non-numeric ids pass through
 * unchanged for the SQLite/UUID case).
 */
function normaliseId(id: string | number | undefined | null): string | number | undefined {
  if (id === undefined || id === null || id === '') return undefined
  if (typeof id === 'number') return id
  return /^\d+$/.test(id) ? Number(id) : id
}

/**
 * Extract the client IP / User-Agent for an audit entry from a Payload
 * request. Console API routes call the Local API (which has no HTTP
 * headers), so they pass the original values via `req.context` — see
 * `actingAs()`. REST/admin requests carry real headers.
 */
export function requestMeta(req: PayloadRequest | undefined | null): { ipAddress?: string; userAgent?: string } {
  if (!req) return {}
  const ctx = (req.context || {}) as AuditRequestContext
  const ip = ctx.auditIp || firstForwardedIp(req.headers?.get?.('x-forwarded-for')) || undefined
  const ua = ctx.auditUserAgent || req.headers?.get?.('user-agent') || undefined
  return { ipAddress: ip, userAgent: ua }
}

/** IP / User-Agent of an incoming Next.js request, for audit entries written directly. */
export function clientMeta(req: { headers: Headers }): { ipAddress?: string; userAgent?: string } {
  return {
    ipAddress: firstForwardedIp(req.headers.get('x-forwarded-for')),
    userAgent: req.headers.get('user-agent') || undefined,
  }
}

function firstForwardedIp(header: string | null | undefined): string | undefined {
  if (!header) return undefined
  return header.split(',')[0]?.trim() || undefined
}

/**
 * Options to spread into a Payload Local API call made from a console
 * route handler so that collection hooks see the acting staff member
 * (`req.user`) and the originating request's IP/User-Agent. Without the
 * `user`, every audit hook bails out (no actor) and nothing is logged.
 *
 *   await p.update({ collection: 'events', id, data, overrideAccess: true, ...actingAs(user, req) })
 */
export function actingAs(
  user: { id: string | number; email?: string; role?: string },
  req: { headers: Headers },
): { user: Record<string, unknown>; context: AuditRequestContext } {
  const { ipAddress, userAgent } = clientMeta(req)
  return {
    user: { ...user, id: normaliseId(user.id), collection: 'users' },
    context: { auditIp: ipAddress, auditUserAgent: userAgent },
  }
}

/**
 * Compute a simplified changes diff for audit purposes.
 * Returns only the fields that differ between old and new values.
 * Sensitive fields are reported as "[redacted]" rather than their values.
 */
export function diffChanges(
  oldDoc: Record<string, unknown>,
  newData: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> | null {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of Object.keys(newData)) {
    if (key === 'updatedAt' || key === 'createdAt') continue
    const oldVal = oldDoc[key]
    const newVal = newData[key]
    if (!isEqual(oldVal, newVal)) {
      changes[key] = REDACTED_KEYS.has(key)
        ? { from: '[redacted]', to: '[redacted]' }
        : { from: summarise(oldVal), to: summarise(newVal) }
    }
  }
  return Object.keys(changes).length > 0 ? changes : null
}

/** Relationship values arrive populated on one side and as ids on the other — compare by id. */
function comparable(v: unknown): unknown {
  if (v && typeof v === 'object' && !Array.isArray(v) && 'id' in (v as Record<string, unknown>)) {
    return (v as { id: unknown }).id
  }
  return v
}

function isEqual(a: unknown, b: unknown): boolean {
  const ca = comparable(a)
  const cb = comparable(b)
  if (ca === cb) return true
  if (ca && cb && typeof ca === 'object' && typeof cb === 'object') {
    try {
      return JSON.stringify(ca) === JSON.stringify(cb)
    } catch {
      return false
    }
  }
  return String(ca ?? '') === String(cb ?? '') && (ca == null) === (cb == null)
}

/** Keep populated relationships from bloating the audit record. */
function summarise(v: unknown): unknown {
  return comparable(v)
}

/**
 * afterChange hook for Payload Globals (site settings, policies, T&Cs):
 * records who changed the global and which fields changed.
 */
export function globalAuditHook(slug: string, label: string) {
  return async ({ doc, previousDoc, req }: {
    doc: Record<string, unknown>
    previousDoc?: Record<string, unknown>
    req: PayloadRequest
  }) => {
    try {
      const actor = req.user as { id?: string | number } | null
      if (actor?.id) {
        auditLog(req.payload, {
          action: 'update',
          actor: actor.id,
          collection: slug,
          documentId: slug,
          detail: `Updated ${label}`,
          changes: diffChanges(previousDoc || {}, doc || {}),
          ...requestMeta(req),
        })
      }
    } catch {
      // audit failure must not block the primary operation
    }
    return doc
  }
}
