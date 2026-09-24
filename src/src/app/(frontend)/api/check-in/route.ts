import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { hashQrToken } from '@/lib/qr/token'
import { verifySession } from '@/lib/rbac/verify-session'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { performCheckIn } from '@/lib/check-in/perform-check-in'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * POST /api/check-in — QR scan check-in endpoint per ADR-003.
 *
 * @compliance ADR-003 verification section, ADR-008 C9 (rate-limited),
 *   C6 (RBAC: admin + door_staff only), C18 (session-only auth).
 */

// --- In-memory rate limiter (sliding window, per ADR-008 C9, C11) ---
// 60 s window, 30 req/min per key. Two-tier: first per-IP (guards against a
// single source hammering the endpoint with unauthenticated requests), then
// per-user (limits how many scans one logged-in staff member can submit).
const rateLimiter = createRateLimiter({ windowMs: 60_000, max: 30 })

async function getAuthUser(
  req: NextRequest,
  p: Payload,
): Promise<{ id: string | number; email: string; role: string } | null> {
  return verifySession(req, p)
}

export async function POST(req: NextRequest) {
  rateLimiter.maybeCleanup()

  const ip = getClientIp(req)

  if (!rateLimiter.check(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const p = await payload()
  const currentUser = await getAuthUser(req, p)

  if (!currentUser) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  if (currentUser.role !== 'admin' && currentUser.role !== 'door_staff') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const userKey = `${ip}:${currentUser.id}`
  if (!rateLimiter.check(userKey)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const token =
    typeof (body as Record<string, unknown>)?.token === 'string'
      ? (body as { token: string }).token.trim()
      : null

  if (!token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 })
  }

  const tokenHash = hashQrToken(token)

  const result = await p.find({
    collection: 'bookings',
    where: { qrTokenHash: { equals: tokenHash } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })

  if (result.totalDocs === 0) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 404 })
  }

  const booking = result.docs[0] as Parameters<typeof performCheckIn>[0]['booking']

  try {
    const checkInResult = await performCheckIn({
      payload: p,
      booking,
      staffUser: currentUser,
    })

    // Include staff name for accountability display (Phase 6 scope 5)
    return NextResponse.json(
      {
        ...checkInResult,
        checkInStaffName: currentUser.email,
      },
      { status: 200 },
    )
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as Error & { code?: string }).code === 'already_checked_in'
    ) {
      return NextResponse.json(
        {
          error: 'already_checked_in',
          checkedInAt: (err as Error & { checkedInAt?: string }).checkedInAt,
          reference: (err as Error & { reference?: string }).reference,
        },
        { status: 409 },
      )
    }
    throw err
  }
}
