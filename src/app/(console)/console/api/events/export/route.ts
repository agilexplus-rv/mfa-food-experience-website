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
 * GET /console/api/events/export
 *
 * Admin-only. Returns CSV of ALL events with details.
 * Columns: Title, Service, Date, Start Time, End Time, Capacity,
 * Price/person (EUR), Status, Location
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

  const result = await p.find({
    collection: 'events',
    limit: 5000,
    sort: 'date',
    depth: 1, // populate service ref
    overrideAccess: true,
  })

  const header =
    'Title,Service,Date,Start Time,End Time,Capacity,Price/person (EUR),Status,Location'

  const rows = result.docs.map((e) => {
    const ev = e as unknown as {
      title: string
      date: string
      startTime: string
      endTime: string
      capacity: number
      pricePerPerson: number
      status: string
      locationRef: string
      service?: { name?: string } | string | number
    }

    const serviceName =
      typeof ev.service === 'object' && ev.service?.name
        ? ev.service.name
        : typeof ev.service === 'string'
          ? ev.service
          : ''

    return [
      escapeCsvField(ev.title),
      escapeCsvField(serviceName),
      escapeCsvField(ev.date),
      escapeCsvField(ev.startTime),
      escapeCsvField(ev.endTime),
      escapeCsvField(ev.capacity),
      escapeCsvField(ev.pricePerPerson),
      escapeCsvField(ev.status),
      escapeCsvField(ev.locationRef),
    ].join(',')
  })

  const csv = [header, ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="all_events.csv"',
    },
  })
}