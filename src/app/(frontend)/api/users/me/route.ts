import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * GET /api/users/me — return the current user's profile.
 *
 * Used by the dashboard and scan pages for role checks and
 * staff identity display (Phase 6 scope 5).
 *
 * @compliance ADR-008 C18 (session-only auth).
 */
export async function GET(req: NextRequest) {
  const p = await payload()
  const currentUser = await verifySession(req, p)

  if (!currentUser) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
    },
  })
}
