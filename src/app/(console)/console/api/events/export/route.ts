import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { auditLog, clientMeta } from '@/lib/audit/helper'
import { csvDate, csvDateTime, csvMoney, csvTime, toCsv } from '@/lib/csv'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * GET /console/api/events/export
 *
 * Admin-only. CSV of ALL events (experience dates) with schedule, pricing,
 * capacity and booking statistics. Money in EUR; dates/times in Malta time.
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

  const [eventsRes, bookingsRes] = await Promise.all([
    p.find({
      collection: 'events',
      limit: 5000,
      sort: 'date',
      depth: 1, // populate service ref
      overrideAccess: true,
    }),
    p.find({
      collection: 'bookings',
      limit: 50000,
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { event: true, status: true, persons: true, totalAmount: true, noShow: true },
    }),
  ])

  // Per-event booking statistics.
  type Stats = { bookings: number; seats: number; checkedIn: number; noShows: number; cancelled: number; revenue: number }
  const stats = new Map<string, Stats>()
  for (const b of bookingsRes.docs as unknown as { event?: unknown; status?: string; persons?: number; totalAmount?: number; noShow?: boolean }[]) {
    const eid = String(typeof b.event === 'object' && b.event ? (b.event as { id: unknown }).id : b.event ?? '')
    if (!eid) continue
    const s = stats.get(eid) ?? { bookings: 0, seats: 0, checkedIn: 0, noShows: 0, cancelled: 0, revenue: 0 }
    if (b.status === 'cancelled') {
      s.cancelled++
    } else if (b.status === 'confirmed' || b.status === 'checked_in') {
      s.bookings++
      s.seats += Number(b.persons) || 0
      s.revenue += Number(b.totalAmount) || 0
      if (b.status === 'checked_in') s.checkedIn += Number(b.persons) || 0
      if (b.noShow) s.noShows++
    }
    stats.set(eid, s)
  }

  const header = [
    'Event ID', 'Title', 'Experience (service)', 'Date', 'Start', 'End', 'Location', 'Status',
    'Capacity', 'Seats booked', 'Seats remaining', 'Confirmed bookings', 'Checked-in guests',
    'No-shows', 'Cancelled bookings', 'Price/person (EUR)', 'Revenue (EUR)',
    'Fully booked override', 'Auto-close (hours after end)', 'Series ID', 'Created', 'Last updated',
  ]

  const rows = eventsRes.docs.map((e) => {
    const ev = e as unknown as {
      id: string | number
      title: string
      date: string
      startTime: string
      endTime: string
      capacity: number
      pricePerPerson: number
      status: string
      locationRef: string
      fullyBookedOverride?: boolean
      autoCloseHoursAfter?: number | null
      seriesId?: string | null
      createdAt: string
      updatedAt: string
      service?: { name?: string } | string | number
    }
    const s = stats.get(String(ev.id)) ?? { bookings: 0, seats: 0, checkedIn: 0, noShows: 0, cancelled: 0, revenue: 0 }
    const serviceName = typeof ev.service === 'object' && ev.service?.name ? ev.service.name : ''
    return [
      ev.id,
      ev.title,
      serviceName,
      csvDate(ev.date),
      csvTime(ev.startTime),
      csvTime(ev.endTime),
      ev.locationRef,
      ev.status,
      ev.capacity,
      s.seats,
      Math.max(0, (Number(ev.capacity) || 0) - s.seats),
      s.bookings,
      s.checkedIn,
      s.noShows,
      s.cancelled,
      csvMoney(ev.pricePerPerson),
      csvMoney(s.revenue),
      ev.fullyBookedOverride ? 'yes' : 'no',
      ev.autoCloseHoursAfter ?? '',
      ev.seriesId ?? '',
      csvDateTime(ev.createdAt),
      csvDateTime(ev.updatedAt),
    ]
  })

  auditLog(p, {
    action: 'export',
    actor: user.id,
    collection: 'events',
    documentId: 'all',
    detail: `Exported ${rows.length} event(s) to CSV`,
    ...clientMeta(req),
  })

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(toCsv(header, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="experiences_${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
