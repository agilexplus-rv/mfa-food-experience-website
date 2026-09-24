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

async function auth(req: NextRequest): Promise<{ id: string | number; email: string; role: string } | null> {
  const p = await payload()
  const user = await verifySession(req, p)
  if (!user || user.role !== 'admin') return null
  return user
}

/** GET /console/api/events — list all events */
export async function GET(req: NextRequest) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const p = await payload()
  const params = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '50', 10) || 50))

  try {
    const result = await p.find({
      collection: 'events',
      page,
      limit,
      sort: '-date',
      depth: 1,
      overrideAccess: true,
    })

    // Compute booking counts per event
    const docs = await Promise.all(
      result.docs.map(async (ev) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = ev as any
        let booked = 0
        let checkedIn = 0
        try {
          const countResult = await p.find({
            collection: 'bookings',
            where: {
              and: [
                { event: { equals: e.id } },
                { status: { not_equals: 'cancelled' } },
              ],
            },
            limit: 0,
            overrideAccess: true,
          })
          booked = countResult.totalDocs

          const ciResult = await p.find({
            collection: 'bookings',
            where: {
              and: [
                { event: { equals: e.id } },
                { status: { equals: 'checked_in' } },
              ],
            },
            limit: 0,
            overrideAccess: true,
          })
          checkedIn = ciResult.totalDocs
        } catch { /* best-effort */ }

        const remaining = e.capacity ? Math.max(0, e.capacity - booked) : 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const service = e.service as any

        return {
          id: e.id,
          title: e.title,
          serviceId: service?.id || service || null,
          serviceName: service?.name || null,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          capacity: e.capacity,
          pricePerPerson: e.pricePerPerson,
          locationRef: e.locationRef,
          status: e.status,
          fullyBookedOverride: e.fullyBookedOverride ?? false,
          seriesId: e.seriesId ?? null,
          booked,
          checkedIn,
          remaining,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
        }
      }),
    )

    return NextResponse.json({
      docs,
      totalDocs: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
    })
  } catch (err) {
    console.error('[console/api/events] Query failed:', err)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }
}

/** POST /console/api/events — create a new event */
export async function POST(req: NextRequest) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const p = await payload()
  const body = await req.json().catch(() => null)
  if (!body || !body.title || !body.serviceId || !body.date || !body.capacity || body.pricePerPerson == null) {
    return NextResponse.json({ error: 'title, serviceId, date, capacity, pricePerPerson are required' }, { status: 400 })
  }

  // --- Recurrence (Rudie 2026-07-12) ---
  // body.recurrence = { frequency: 'weekly'|'biweekly'|'monthly', until: 'YYYY-MM-DD' }
  // Generates one concrete event row per occurrence, all sharing a
  // seriesId (UUID). Bounded at 52 occurrences as a safety valve
  // (weekly for a year); until is inclusive. Times shift with the
  // date: startTime/endTime keep their time-of-day on each new date.
  const recurrence = body.recurrence as
    | { frequency?: string; until?: string }
    | undefined

  const occurrenceDates: string[] = [body.date]
  if (recurrence?.frequency && recurrence?.until) {
    const stepDays =
      recurrence.frequency === 'weekly' ? 7 :
      recurrence.frequency === 'biweekly' ? 14 :
      recurrence.frequency === 'monthly' ? 0 : -1
    if (stepDays === -1) {
      return NextResponse.json({ error: 'invalid_frequency' }, { status: 400 })
    }
    const until = new Date(`${recurrence.until}T23:59:59Z`)
    if (Number.isNaN(until.getTime())) {
      return NextResponse.json({ error: 'invalid_until_date' }, { status: 400 })
    }
    const cursor = new Date(`${body.date}T00:00:00Z`)
    for (let i = 0; i < 51; i++) {
      if (stepDays > 0) {
        cursor.setUTCDate(cursor.getUTCDate() + stepDays)
      } else {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1)
      }
      if (cursor > until) break
      occurrenceDates.push(cursor.toISOString().slice(0, 10))
    }
  }

  /** Shift an ISO/naive datetime's DATE to a new day, keeping time-of-day. */
  const shiftToDate = (dateTime: string, newDate: string): string => {
    const timePart = dateTime.includes('T') ? dateTime.slice(dateTime.indexOf('T')) : 'T00:00:00.000Z'
    return `${newDate}${timePart}`
  }

  const seriesId = occurrenceDates.length > 1 ? crypto.randomUUID() : undefined
  const baseStart = body.startTime || body.date
  const baseEnd = body.endTime || body.date

  try {
    const createdIds: string[] = []
    for (const date of occurrenceDates) {
      const event = await p.create({
        collection: 'events',
        data: {
          title: body.title.trim(),
          service: body.serviceId,
          date,
          startTime: shiftToDate(baseStart, date),
          endTime: shiftToDate(baseEnd, date),
          capacity: body.capacity,
          pricePerPerson: body.pricePerPerson,
          locationRef: body.locationRef || '',
          status: body.status || 'scheduled',
          fullyBookedOverride: body.fullyBookedOverride ?? false,
          ...(seriesId ? { seriesId } : {}),
        },
        overrideAccess: true,
      })
      createdIds.push(String(event.id))
    }

    return NextResponse.json(
      { ok: true, id: createdIds[0], created: createdIds.length, seriesId: seriesId ?? null },
      { status: 201 },
    )
  } catch (err) {
    console.error('[console/api/events] Create failed:', err)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }
}
