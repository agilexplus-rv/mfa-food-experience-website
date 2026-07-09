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
 * GET /api/bookings/export?eventId=X
 *
 * Admin-only. Returns CSV of all bookings for a given event.
 * Columns: reference, attendee, email, phone, persons, status,
 * totalAmount, dietaryNotes (if consented), checkedInAt
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
  if (!eventId) {
    return NextResponse.json({ error: 'eventId query parameter is required' }, { status: 400 })
  }

  // Verify event exists
  const eventDoc = await p.findByID({ collection: 'events', id: eventId, overrideAccess: true }).catch(() => null)
  if (!eventDoc) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }

  // Get all bookings for the event
  const result = await p.find({
    collection: 'bookings',
    where: { event: { equals: eventId } },
    limit: 500,
    sort: 'createdAt',
    overrideAccess: true,
  })

  // Build CSV
  const header = 'Reference,Attendee Name,Email,Phone,Persons,Status,Total (EUR),Dietary Notes,Checked In At'
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
    }
    const dietary = booking.dietaryConsent ? (booking.dietaryNotes || '') : ''
    return [
      escapeCsvField(booking.reference),
      escapeCsvField(booking.leadAttendeeName),
      escapeCsvField(booking.email),
      escapeCsvField(booking.phone || ''),
      escapeCsvField(booking.persons),
      escapeCsvField(booking.status),
      escapeCsvField(booking.totalAmount),
      escapeCsvField(dietary),
      escapeCsvField(booking.checkedInAt || ''),
    ].join(',')
  })

  const csv = [header, ...rows].join('\n')
  const eventTitle = ((eventDoc as { title?: string }).title || eventId).replace(/[^a-zA-Z0-9]/g, '_')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bookings_${eventTitle}.csv"`,
    },
  })
}
