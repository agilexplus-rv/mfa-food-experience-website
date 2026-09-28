import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { auditLog, clientMeta } from '@/lib/audit/helper'
import { csvDate, csvDateTime, csvEventTime, csvMoney, toCsv } from '@/lib/csv'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * GET /console/api/bookings/export?eventId=...&q=...&status=... (all optional)
 *
 * Admin-only. CSV of bookings -- all bookings, or the full set matching
 * the given filters (same semantics as the console search endpoint:
 * `q` likes reference/name/email, `status` exact, `eventId` exact),
 * never paginated. Money in EUR; dates/times in Malta time. Dietary
 * notes are only included where the attendee consented (GDPR Art. 9).
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

  const rawEventId = req.nextUrl.searchParams.get('eventId')
  const eventId = rawEventId ? Number(rawEventId) : null
  if (rawEventId && !Number.isFinite(eventId)) {
    return NextResponse.json({ error: 'invalid_event_id' }, { status: 400 })
  }
  const q = req.nextUrl.searchParams.get('q')?.trim() || undefined
  const status = req.nextUrl.searchParams.get('status') || undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const and: any[] = []
  if (q) {
    and.push({
      or: [
        { reference: { like: q } },
        { leadAttendeeName: { like: q } },
        { email: { like: q } },
      ],
    })
  }
  if (status) and.push({ status: { equals: status } })
  if (eventId !== null) and.push({ event: { equals: eventId } })

  const result = await p.find({
    collection: 'bookings',
    limit: 50000,
    pagination: false,
    sort: 'createdAt',
    depth: 1, // populate event, coupon, check-in staff
    overrideAccess: true,
    ...(and.length > 0 ? { where: { and } } : {}),
  })

  const header = [
    'Booking ID', 'Reference', 'Status', 'Event ID', 'Experience', 'Experience date', 'Start', 'Location',
    'Lead attendee', 'Email', 'Phone', 'Persons', 'Language', 'Total (EUR)', 'Payment method',
    'Coupon', 'T&Cs accepted', 'Dietary notes (consented)', 'Checked in at', 'Checked in by',
    'No-show', 'Refund status', 'Booked at',
  ]

  const rows = result.docs.map((b) => {
    const booking = b as unknown as {
      id: string | number
      reference: string
      status: string
      leadAttendeeName: string
      email: string
      phone?: string | null
      persons: number
      language?: string | null
      totalAmount: number
      paymentMethod?: string | null
      termsAccepted?: boolean | null
      dietaryNotes?: string | null
      dietaryConsent?: boolean
      checkedInAt?: string | null
      noShow?: boolean | null
      refundStatus?: string | null
      createdAt: string
      event?: { id?: string | number; title?: string; date?: string; startTime?: string; locationRef?: string } | string | number | null
      coupon?: { code?: string } | string | number | null
      checkInStaff?: { email?: string } | string | number | null
    }

    const ev = typeof booking.event === 'object' && booking.event ? booking.event : null
    const evId = ev ? ev.id : booking.event
    const coupon = typeof booking.coupon === 'object' && booking.coupon ? booking.coupon.code : ''
    const staff = typeof booking.checkInStaff === 'object' && booking.checkInStaff ? booking.checkInStaff.email : ''

    return [
      booking.id,
      booking.reference,
      booking.status,
      evId ?? '',
      ev?.title ?? '',
      csvDate(ev?.date),
      csvEventTime(ev?.startTime),
      ev?.locationRef ?? '',
      booking.leadAttendeeName,
      booking.email,
      booking.phone || '',
      booking.persons,
      booking.language || '',
      csvMoney(booking.totalAmount),
      booking.paymentMethod || '',
      coupon || '',
      booking.termsAccepted ? 'yes' : 'no',
      booking.dietaryConsent ? (booking.dietaryNotes || '') : '',
      csvDateTime(booking.checkedInAt),
      staff || '',
      booking.noShow ? 'yes' : 'no',
      booking.refundStatus || '',
      csvDateTime(booking.createdAt),
    ]
  })

  auditLog(p, {
    action: 'export',
    actor: user.id,
    collection: 'bookings',
    documentId: eventId !== null ? String(eventId) : 'all',
    detail: `Exported ${rows.length} booking(s) to CSV${eventId !== null ? ` for event ${eventId}` : ''}`
      + (status ? `, status=${status}` : '')
      + (q ? `, q=${q}` : ''),
    ...clientMeta(req),
  })

  const stamp = new Date().toISOString().slice(0, 10)
  const suffix = eventId !== null ? `_event_${eventId}` : (q || status ? '_filtered' : '_all')
  return new NextResponse(toCsv(header, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bookings${suffix}_${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
