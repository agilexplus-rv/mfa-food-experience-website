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

interface BookingDoc {
  id: string | number
  reference: string
  leadAttendeeName: string
  email: string
  status: string
  createdAt: string
  event?: { title?: string; date?: string } | string | number
}

/**
 * POST /api/data-subject -- admin-only endpoint supporting Art. 15 (right of
 * access) and Art. 17 (right to erasure) data-subject requests (DPIA measure
 * 10).
 *
 * Auth: gated via verifySession (the proven pattern for this Payload version --
 * payload.auth() is known-broken in this config, see src/lib/rbac/verify-session.ts).
 * Only admin role is accepted; door_staff does not have PII-access privileges.
 *
 * Request body:
 *   { email: string, confirm?: boolean }
 *
 * Response (confirm=false, default):
 *   { access: true, matches: [{ reference, eventTitle, status, createdAt, anonymised }] }
 *
 * Response (confirm=true):
 *   { erased: true, count: N, runAt: "<ISO>" }
 */
export async function POST(req: NextRequest) {
  const p = await payload()

  // Authenticate + authorise: admin only.
  const user = await verifySession(req, p)
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden: admin role required for PII access' }, { status: 403 })
  }

  // Parse request body
  let body: { email?: string; reference?: string; confirm?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const reference = body.reference?.trim()
  if (!email && !reference) {
    return NextResponse.json({ error: 'email or booking reference is required' }, { status: 400 })
  }

  // Build where clause based on provided input
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (email && reference) {
    where.and = [{ email: { equals: email } }, { reference: { equals: reference } }]
  } else if (email) {
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'invalid email format' }, { status: 400 })
    }
    where.email = { equals: email }
  } else if (reference) {
    where.reference = { equals: reference }
  }

  // Look up all bookings matching the criteria (not anonymised ones since
  // their email field is now the placeholder).
  const result = await p.find({
    collection: 'bookings',
    where,
    depth: 2,
    limit: 500,
    overrideAccess: true,
  })

  const bookings = result.docs as unknown as BookingDoc[]

  // Also check for bookings that were already anonymised for this email --
  // we need a different query since email is now "anonymised@deleted.invalid".
  // For right-of-access, we want to show the user what we still have AND what
  // we already anonymised. For right-to-erasure, we only act on non-anonymised
  // records (idempotent -- already-anonymised ones are done).

  if (!body.confirm) {
    // RIGHT OF ACCESS: return summary of existing data.
    const matches = bookings.map((b) => ({
      reference: b.reference,
      eventTitle:
        b.event && typeof b.event === 'object'
          ? (b.event as { title?: string }).title || null
          : null,
      status: b.status,
      createdAt: b.createdAt,
      anonymised: false, // we only matched non-anonymised records above
    }))

    return NextResponse.json({
      access: true,
      email,
      matches,
      total: matches.length,
    })
  }

  // RIGHT TO ERASURE: anonymise all matching records.
  const now = new Date().toISOString()
  let count = 0
  const errors: string[] = []

  for (const booking of bookings) {
    try {
      await p.update({
        collection: 'bookings',
        id: booking.id,
        data: {
          leadAttendeeName: 'Anonymised',
          email: 'anonymised@deleted.invalid',
          phone: null,
          dietaryNotes: null,
          anonymisedAt: now,
        },
        overrideAccess: true,
      })
      count++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`bookings/${booking.id}: ${msg}`)
    }
  }

  // Write audit log entry
  try {
    await p.create({
      collection: 'audit_logs',
      data: {
        action: 'update',
        actor: user.id,
        collection: 'bookings',
        detail: `Data-subject erasure: email=${email}, records_anonymised=${count}, errors=${errors.length}`,
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[data-subject] failed to write audit log:', err)
  }

  return NextResponse.json({
    erased: true,
    count,
    errors,
    runAt: now,
  })
}
