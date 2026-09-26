import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { clientMeta } from '@/lib/audit/helper'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * POST /console/api/audit-log/logout
 *
 * Writes a 'logout' entry to the audit_logs collection.
 *
 * The ConsoleShell client calls this endpoint right before hitting
 * Payload's own /api/users/logout, so the audit entry is captured
 * while the user's session cookie is still valid (needed to resolve
 * the actor user id for the audit_logs relationship field). The
 * follow-up Payload logout is sent with `X-Audit-Logged: 1` so the
 * Users afterLogout hook doesn't record the same logout twice.
 *
 * The write is best-effort: if it fails, logout still proceeds.
 */
export async function POST(req: NextRequest) {
  const p = await payload()
  const user = await verifySession(req, p)
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { ipAddress, userAgent } = clientMeta(req)

  try {
    await p.create({
      collection: 'audit_logs',
      overrideAccess: true,
      data: {
        action: 'logout',
        actor: user.id,
        collection: 'users',
        documentId: String(user.id),
        detail: `User ${user.email} logged out (role: ${user.role})`,
        ...(ipAddress ? { ipAddress } : {}),
        ...(userAgent ? { userAgent } : {}),
      },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[AuditLog] Failed to write logout entry:', err)
    return NextResponse.json({ error: 'write_failed' }, { status: 500 })
  }
}
