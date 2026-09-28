import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { actingAs } from '@/lib/audit/helper'
import { payloadErrorMessage } from '@/lib/api-errors'
import { MAX_SERIES_EVENTS, composeOnDay, dayStart, isDay, occurrenceDates, timeOfDay } from '@/lib/events/recurrence'

/** Empty / invalid / non-positive -> null (auto-close disabled). */
function toAutoCloseHours(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

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

        // Fully Booked Override (FR-2.5) forces 0 remaining, matching the public pages.
        const remaining = e.fullyBookedOverride ? 0 : (e.capacity ? Math.max(0, e.capacity - booked) : 0)
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
          autoCloseHoursAfter: e.autoCloseHoursAfter ?? null,
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
  if (
    !body ||
    !body.title ||
    !body.serviceId ||
    !body.date ||
    !body.startTime ||
    !body.endTime ||
    !body.capacity ||
    body.pricePerPerson == null ||
    !String(body.locationRef || '').trim()
  ) {
    return NextResponse.json(
      { error: 'title, serviceId, date, startTime, endTime, capacity, pricePerPerson, and locationRef are required' },
      { status: 400 },
    )
  }

  // Date is the single source of the day; Start/End contribute only their
  // time-of-day (HH:MM), composed onto each occurrence's own day as
  // literal UTC (see src/lib/events/recurrence.ts). An end time earlier
  // than the start means the event runs past midnight.
  const day = String(body.date).slice(0, 10)
  if (!isDay(day)) return NextResponse.json({ error: 'invalid_date' }, { status: 400 })
  const startT = timeOfDay(body.startTime)
  const endT = timeOfDay(body.endTime)
  if (!startT || !endT) {
    return NextResponse.json({ error: 'startTime and endTime must be HH:MM' }, { status: 400 })
  }

  // --- Recurrence (Rudie 2026-07-12) ---
  // body.recurrence = { frequency: 'weekly'|'biweekly'|'monthly', until: 'YYYY-MM-DD' }
  // Generates one concrete event row per occurrence, all sharing a
  // seriesId (UUID). Bounded at MAX_SERIES_EVENTS (52, incl. the first)
  // as a safety valve (weekly for a year); until is inclusive. Day math
  // lives in occurrenceDates(); every occurrence keeps the same
  // time-of-day on its own date.
  const recurrence = body.recurrence as
    | { frequency?: string; until?: string }
    | undefined

  const occurrenceDatesList: string[] = [day]
  if (recurrence?.frequency && recurrence?.until) {
    const r = occurrenceDates({
      anchor: day,
      frequency: recurrence.frequency,
      until: recurrence.until,
      max: MAX_SERIES_EVENTS - 1,
    })
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })
    occurrenceDatesList.push(...r.dates)
  }

  const seriesId = occurrenceDatesList.length > 1 ? crypto.randomUUID() : undefined

  try {
    const createdIds: string[] = []
    for (const d of occurrenceDatesList) {
      const event = await p.create({
        collection: 'events',
        data: {
          title: body.title.trim(),
          service: Number(body.serviceId),
          date: dayStart(d),
          startTime: composeOnDay(d, startT),
          endTime: composeOnDay(d, endT),
          capacity: body.capacity,
          pricePerPerson: body.pricePerPerson,
          locationRef: body.locationRef || '',
          status: body.status || 'scheduled',
          fullyBookedOverride: body.fullyBookedOverride ?? false,
          autoCloseHoursAfter: toAutoCloseHours(body.autoCloseHoursAfter),
          ...(seriesId ? { seriesId } : {}),
        },
        overrideAccess: true,
        ...actingAs(currentUser, req),
      })
      createdIds.push(String(event.id))
    }

    return NextResponse.json(
      { ok: true, id: createdIds[0], created: createdIds.length, seriesId: seriesId ?? null },
      { status: 201 },
    )
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}${err.stack ? '\n' + err.stack : ''}` : JSON.stringify(err)
    console.error('[console/api/events] Create failed:', msg)
    const validation = payloadErrorMessage(err)
    if (validation) return NextResponse.json({ error: validation }, { status: 400 })
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }
}
