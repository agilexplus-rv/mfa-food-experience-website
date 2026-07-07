import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { hashQrToken } from '@/lib/qr/token'
import { verifySession } from '@/lib/rbac/verify-session'

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
const rateLimitWindow = 60_000
const rateLimitMax = 30
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + rateLimitWindow })
    return true
  }
  if (entry.count >= rateLimitMax) return false
  entry.count++
  return true
}

let lastCleanup = 0
function maybeCleanupRateLimits() {
  const now = Date.now()
  if (now - lastCleanup < 300_000) return
  lastCleanup = now
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetAt) rateLimitMap.delete(k)
  }
}

async function getAuthUser(
  req: NextRequest,
  p: Payload,
): Promise<{ id: string | number; email: string; role: string } | null> {
  return verifySession(req, p)
}

export async function POST(req: NextRequest) {
  maybeCleanupRateLimits()

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'

  if (!checkRateLimit(ip)) {
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
  if (!checkRateLimit(userKey)) {
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
    overrideAccess: true,
  })

  if (result.totalDocs === 0) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 404 })
  }

  const booking = result.docs[0] as {
    id: string | number
    reference: string
    leadAttendeeName: string
    email: string
    persons: number
    status: string
    totalAmount: number
    checkedInAt: string | null
    event: string | number | { id: string | number; title?: string }
  }

  if (booking.checkedInAt) {
    return NextResponse.json(
      {
        error: 'already_checked_in',
        checkedInAt: booking.checkedInAt,
        reference: booking.reference,
      },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()

  await p.update({
    collection: 'bookings',
    id: booking.id,
    data: {
      checkedInAt: now,
      checkInStaff: currentUser.id as string,
      status: 'checked_in',
    },
    overrideAccess: true,
  })

  await p.create({
    collection: 'audit_logs',
    data: {
      action: 'check_in',
      actor: currentUser.id as string,
      collection: 'bookings',
      documentId: String(booking.id),
      detail: booking.reference,
    },
    overrideAccess: true,
  })

  const eventTitle =
    typeof booking.event === 'object' ? booking.event.title : undefined

  return NextResponse.json(
    {
      reference: booking.reference,
      eventTitle,
      leadAttendeeName: booking.leadAttendeeName,
      persons: booking.persons,
      status: 'checked_in',
      totalAmount: booking.totalAmount,
      checkedInAt: now,
    },
    { status: 200 },
  )
}
