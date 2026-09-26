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

function escapeCsvField(val: unknown): string {
  const str = val === null || val === undefined ? '' : String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

/**
 * GET /console/api/bookings/export?eventId=... (optional)
 *
 * Admin-only. Returns CSV of bookings. When an eventId query param is
 * provided, returns bookings for that event only. Otherwise exports
 * ALL bookings across all events.
 *
 * Columns: Reference, Attendee Name, Email, Phone, Persons, Status,
 * Total (EUR), Event, Date, Dietary Notes, Checked In At, Created
 */
export async function GET(req: NextRequest) {
  const p = await payload()

  const user = await verifySession(req, p)
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const eventId = req.nextUrl.searchParams.get('eventId')

  const findArgs = {
    collection: 'bookings' as const,
    limit: 5000,
    sort: 'createdAt',
    depth: 1, // populate event ref to get title/date
    overrideAccess: true,
  }

  const result = eventId
    ? await p.find({
        ...findArgs,
        where: { event: { equals: eventId } },
      })
    : await p.find(findArgs)

  const header =
    'Reference,Attendee Name,Email,Phone,Persons,Status,Total (EUR),Event,Date,Dietary Notes,Checked In At,Created'

  const rows = result.docs.map((b) => {
    const booking = b as unknown as {
      reference: string
      leadAttendeeName: string
      email: string
      phone?: string | null
      persons: number
      status: string
      totalAmount: number
      dietaryNotes?: string | null
      dietaryConsent?: boolean
      checkedInAt?: string | null
      createdAt: string
      event?: { title?: string; date?: string } | string | number
    }

    const dietary = booking.dietaryConsent ? (booking.dietaryNotes || '') : ''
    const eventTitle =
      typeof booking.event === 'object' && booking.event?.title
        ? booking.event.title
        : typeof booking.event === 'string'
          ? booking.event
          : ''
    const eventDate =
      typeof booking.event === 'object' && booking.event?.date
        ? booking.event.date
        : ''

    return [
      escapeCsvField(booking.reference),
      escapeCsvField(booking.leadAttendeeName),
      escapeCsvField(booking.email),
      escapeCsvField(booking.phone || ''),
      escapeCsvField(booking.persons),
      escapeCsvField(booking.status),
      escapeCsvField(booking.totalAmount),
      escapeCsvField(eventTitle),
      escapeCsvField(eventDate),
      escapeCsvField(dietary),
      escapeCsvField(booking.checkedInAt || ''),
      escapeCsvField(booking.createdAt),
    ].join(',')
  })

  const csv = [header, ...rows].join('\n')
  const suffix = eventId
    ? `_event_${eventId}`
    : '_all'

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bookings${suffix}.csv"`,
    },
  })
}