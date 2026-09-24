import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { performCheckIn } from '@/lib/check-in/perform-check-in'

/**
 * POST /api/check-in/by-booking-id — manual-lookup check-in endpoint.
 *
 * Allows door staff to check in a booking by its database ID
 * (e.g. from a name/reference search) instead of by QR token.
 * Reuses the shared performCheckIn() logic — no duplication of
 * the audit-log or booking-update logic.
 *
 * @compliance ADR-008 C6 (RBAC: admin + door_staff only),
 *   C9 (rate-limited), C18 (session-only auth).
 */

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

const rateLimiter = createRateLimiter({ windowMs: 60_000, max: 30 })

export async function POST(req: NextRequest) {
  rateLimiter.maybeCleanup()

  const ip = getClientIp(req)

  if (!rateLimiter.check(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const p = await payload()
  const currentUser = await verifySession(req, p)

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

  const bookingId =
    typeof (body as Record<string, unknown>)?.bookingId === 'string'
      ? (body as { bookingId: string }).bookingId
      : typeof (body as Record<string, unknown>)?.bookingId === 'number'
        ? String((body as { bookingId: number }).bookingId)
        : null

  if (!bookingId) {
    return NextResponse.json({ error: 'missing_booking_id' }, { status: 400 })
  }

  // Fetch the booking by ID
  let booking
  try {
    booking = await p.findByID({
      collection: 'bookings',
      id: bookingId,
      depth: 1,
      overrideAccess: true,
    })
  } catch {
    return NextResponse.json({ error: 'invalid_booking_id' }, { status: 404 })
  }

  if (!booking) {
    return NextResponse.json({ error: 'invalid_booking_id' }, { status: 404 })
  }

  try {
    const result = await performCheckIn({
      payload: p,
      booking: booking as Parameters<typeof performCheckIn>[0]['booking'],
      staffUser: currentUser,
    })

    // Add staff name to response for accountability display
    return NextResponse.json(
      {
        ...result,
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
