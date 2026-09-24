import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { cronSecret } from '@/lib/env'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

function monthsAgo(n: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

interface BookingDoc {
  id: string | number
  leadAttendeeName: string
  email: string
  phone?: string | null
  dietaryNotes?: string | null
  anonymisedAt?: string | null
  status: string
  event?: { id: string | number; date?: string } | string | number
  createdAt: string
}

/**
 * GET /api/cron/retention -- Vercel Cron runs this daily to anonymise
 * PII from bookings past their retention threshold (DPIA measures 6, 10).
 *
 * Protected by the same CRON_SECRET header pattern as sweep-holds.
 * Idempotent: skips rows where anonymisedAt is already set.
 */
export async function GET(req: NextRequest) {
  const expected = cronSecret()
  if (expected) {
    const authHeader = req.headers.get('authorization')
    const customHeader = req.headers.get('x-cron-secret')
    const bearerOk = authHeader === `Bearer ${expected}`
    const customOk = customHeader === expected
    if (!bearerOk && !customOk) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  } else {
    console.warn('[cron/retention] CRON_SECRET is not set -- endpoint is unauthenticated.')
  }

  const p = await payload()
  const now = new Date()
  const cutoff24m = monthsAgo(24)
  const cutoff90d = daysAgo(90)

  // Fetch all non-pending bookings that haven't been anonymised yet.
  // We fetch with depth=2 to resolve event.date, then filter in-app
  // because Payload's query DSL does not support "event.date < X"
  // as a where clause (relationship date traversal).
  const result = await p.find({
    collection: 'bookings',
    where: {
      anonymisedAt: { equals: null },
      status: { in: ['confirmed', 'cancelled', 'checked_in'] },
    },
    depth: 2,
    limit: 1000,
    overrideAccess: true,
  })

  const errors: string[] = []
  let processed = 0

  const bookings = result.docs as unknown as BookingDoc[]

  for (const booking of bookings) {
    try {
      const eventDate =
        booking.event && typeof booking.event === 'object'
          ? (booking.event as { date?: string }).date
          : null

      const threshold = eventDate ? new Date(eventDate) : null

      // Skip if we can't determine the event date AND createdAt is recent
      if (!threshold) {
        // Fallback: use createdAt as the clock
        const fallback = new Date(booking.createdAt)
        if (fallback > cutoff24m) continue
      } else if (threshold > cutoff24m) {
        // Event date is still within the 24-month window
        continue
      }

      // Anonymise PII fields
      await p.update({
        collection: 'bookings',
        id: booking.id,
        data: {
          leadAttendeeName: 'Anonymised',
          email: 'anonymised@deleted.invalid',
          phone: null,
          dietaryNotes: null,
          anonymisedAt: now.toISOString(),
        },
        overrideAccess: true,
      })

      processed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`bookings/${booking.id}: ${msg}`)
    }
  }

  // Also process pending bookings older than 90 days
  const pendingResult = await p.find({
    collection: 'bookings',
    where: {
      anonymisedAt: { equals: null },
      status: { equals: 'pending' },
      createdAt: { less_than: cutoff90d.toISOString() },
    },
    limit: 1000,
    overrideAccess: true,
  })

  const pendingBookings = pendingResult.docs as unknown as BookingDoc[]

  for (const booking of pendingBookings) {
    try {
      await p.update({
        collection: 'bookings',
        id: booking.id,
        data: {
          leadAttendeeName: 'Anonymised',
          email: 'anonymised@deleted.invalid',
          phone: null,
          dietaryNotes: null,
          anonymisedAt: now.toISOString(),
        },
        overrideAccess: true,
      })
      processed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`bookings/${booking.id}: ${msg}`)
    }
  }

  // Anonymise rejected testimonials older than 30 days
  const cutoff30d = daysAgo(30)
  const testimonialResult = await p.find({
    collection: 'testimonials',
    where: {
      anonymisedAt: { equals: null },
      approved: { equals: false },
      updatedAt: { less_than: cutoff30d.toISOString() },
    },
    limit: 1000,
    overrideAccess: true,
  })

  for (const t of testimonialResult.docs) {
    try {
      await p.update({
        collection: 'testimonials',
        id: t.id,
        data: {
          name: 'Anonymised',
          anonymisedAt: now.toISOString(),
        },
        overrideAccess: true,
      })
      processed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`testimonials/${t.id}: ${msg}`)
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    errors,
    runAt: now.toISOString(),
  })
}
