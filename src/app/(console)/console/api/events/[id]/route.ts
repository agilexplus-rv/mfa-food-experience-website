import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { actingAs } from '@/lib/audit/helper'
import { payloadErrorMessage } from '@/lib/api-errors'
import {
  MAX_SERIES_EVENTS, composeOnDay, dayStart, isDay, occurrenceDates, timeOfDay, todayMalta,
} from '@/lib/events/recurrence'

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

/** GET /console/api/events/[id] — get single event */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const numericId = Number(id)
  const p = await payload()

  try {
    const ev = await p.findByID({
      collection: 'events',
      id: numericId,
      depth: 1,
      overrideAccess: true,
    })
    if (!ev) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = ev as any
    return NextResponse.json(e)
  } catch (err) {
    console.error('[console/api/events] Get failed:', err)
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
  }
}

/** PATCH /console/api/events/[id] — update an event */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const numericId = Number(id)
  const p = await payload()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  // --- Repeat from an existing NON-series event ---
  // body.recurrence = { frequency, until } turns this event into the
  // anchor of a new series (see the repeat block below). Pulled out first
  // so p.update never sees it.
  const recurrence = body.recurrence as { frequency?: string; until?: string } | undefined
  delete body.recurrence

  // --- Series-scoped updates (Rudie 2026-07-12) ---
  // body.applyTo: 'single' (default) | 'future'.
  // 'future' = apply the same field changes to this event AND every
  // LATER event in the same series (matching on seriesId + date >=
  // this event's date). Date/startTime/endTime are NEVER propagated to
  // future occurrences -- each occurrence keeps its own date; only the
  // time-of-day of start/end is shifted onto each occurrence's date.
  // Status changes DO propagate (e.g. cancel this and all future).
  const applyTo = body.applyTo === 'future' ? 'future' : 'single'
  delete body.applyTo
  // The console form reuses one payload for create+edit; POST needs
  // serviceId, PATCH uses the real field name 'service'. Strip the
  // helper key so Payload never sees an unknown field.
  delete body.serviceId
  // Drizzle's integer FK column rejects the form's string id.
  if (body.service !== undefined && body.service !== null && body.service !== '') {
    body.service = Number(typeof body.service === 'object' ? body.service.id : body.service)
  }
  if ('autoCloseHoursAfter' in body) {
    const n = Number(body.autoCloseHoursAfter)
    body.autoCloseHoursAfter =
      body.autoCloseHoursAfter === '' || body.autoCloseHoursAfter === null || !Number.isFinite(n) || n <= 0 ? null : n
  }
  if ('locationRef' in body && !String(body.locationRef || '').trim()) {
    return NextResponse.json({ error: 'locationRef is required' }, { status: 400 })
  }
  if ('startTime' in body && !body.startTime) {
    return NextResponse.json({ error: 'startTime is required' }, { status: 400 })
  }
  if ('endTime' in body && !body.endTime) {
    return NextResponse.json({ error: 'endTime is required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any
  try {
    current = await p.findByID({
      collection: 'events',
      id: numericId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    current = null
  }
  if (!current) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Date is the single source of the day; Start/End contribute only their
  // time-of-day, re-composed onto that day as literal UTC (see
  // src/lib/events/recurrence.ts). An end time earlier than the start
  // means the event runs past midnight.
  const day = typeof body.date === 'string' && body.date ? body.date.slice(0, 10) : String(current.date ?? '').slice(0, 10)
  const repeating = !!recurrence?.frequency && recurrence.frequency !== 'none'
  if (('date' in body || 'startTime' in body || 'endTime' in body || repeating) && !isDay(day)) {
    return NextResponse.json({ error: 'invalid_date' }, { status: 400 })
  }
  if ('date' in body) body.date = dayStart(day)
  if ('startTime' in body) {
    const t = timeOfDay(body.startTime)
    if (!t) return NextResponse.json({ error: 'startTime is required (HH:MM)' }, { status: 400 })
    body.startTime = composeOnDay(day, t)
  }
  if ('endTime' in body) {
    const t = timeOfDay(body.endTime)
    if (!t) return NextResponse.json({ error: 'endTime is required (HH:MM)' }, { status: 400 })
    body.endTime = composeOnDay(day, t)
  }

  // Repeat: the edited event becomes the series anchor (fresh seriesId)
  // and only FUTURE copies are created -- from one step after the anchor,
  // or (past anchor) from the first cadence date >= today (Malta), up to
  // `until` inclusive, max MAX_SERIES_EVENTS incl. this event. The edited
  // event is never duplicated and keeps its bookings.
  let copyDates: string[] = []
  if (repeating && recurrence?.frequency) {
    // Server-side guard against double creation (e.g. a re-click after a
    // partial failure: the anchor already carries the seriesId).
    if (current.seriesId) {
      return NextResponse.json(
        { error: 'already_in_series', message: 'This event is already part of a recurring series.' },
        { status: 409 },
      )
    }
    const r = occurrenceDates({
      anchor: day,
      frequency: recurrence.frequency,
      until: String(recurrence.until ?? ''),
      notBefore: todayMalta(),
      max: MAX_SERIES_EVENTS - 1,
    })
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })
    if (r.dates.length === 0) {
      return NextResponse.json(
        {
          error: 'no_occurrences',
          message: 'No repeat dates fall between today/the event date and the repeat-until date.',
        },
        { status: 400 },
      )
    }
    copyDates = r.dates
    body.seriesId = crypto.randomUUID()
  }

  try {
    const updated = await p.update({
      collection: 'events',
      id: numericId,
      data: body,
      depth: 0,
      overrideAccess: true,
      ...actingAs(currentUser, req),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any

    let created = 0
    if (copyDates.length > 0) {
      const startT = timeOfDay(updated.startTime)
      const endT = timeOfDay(updated.endTime)
      try {
        for (const d of copyDates) {
          await p.create({
            collection: 'events',
            data: {
              title: updated.title,
              service: Number(typeof updated.service === 'object' && updated.service ? updated.service.id : updated.service),
              date: dayStart(d),
              ...(startT ? { startTime: composeOnDay(d, startT) } : {}),
              ...(endT ? { endTime: composeOnDay(d, endT) } : {}),
              capacity: updated.capacity,
              pricePerPerson: updated.pricePerPerson,
              locationRef: updated.locationRef,
              // An auto-completed (past) anchor must not hide its future copies.
              status: updated.status === 'completed' ? 'scheduled' : updated.status,
              fullyBookedOverride: updated.fullyBookedOverride ?? false,
              autoCloseHoursAfter: updated.autoCloseHoursAfter ?? null,
              seriesId: body.seriesId,
            },
            overrideAccess: true,
            ...actingAs(currentUser, req),
          })
          created++
        }
      } catch (err) {
        // No rollback (one row per create, same as POST). The anchor
        // already carries the seriesId, so a re-run is blocked (409).
        console.error('[console/api/events] Series copy create failed:', err)
        return NextResponse.json(
          {
            error: 'series_partial',
            message: `Event saved, but only ${created} of ${copyDates.length} repeat dates were created.`,
            created,
            seriesId: body.seriesId,
          },
          { status: 500 },
        )
      }
    }

    let futureUpdated = 0
    if (applyTo === 'future' && current?.seriesId) {
      // Fields that make sense to propagate. Explicit allowlist so a
      // stray date/id field can never clobber sibling occurrences.
      const timeOf = (dt: unknown): string | null =>
        typeof dt === 'string' && dt.includes('T') ? dt.slice(dt.indexOf('T')) : null
      const propagate: Record<string, unknown> = {}
      for (const k of ['title', 'service', 'capacity', 'pricePerPerson', 'locationRef', 'status', 'fullyBookedOverride', 'autoCloseHoursAfter']) {
        if (k in body) propagate[k] = body[k]
      }
      const startT = timeOf(body.startTime)
      const endT = timeOf(body.endTime)

      const siblings = await p.find({
        collection: 'events',
        where: {
          and: [
            { seriesId: { equals: current.seriesId } },
            { date: { greater_than: current.date } },
          ],
        },
        limit: 100,
        overrideAccess: true,
      })
      for (const sib of siblings.docs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = sib as any
        const sibDate = typeof s.date === 'string' ? s.date.slice(0, 10) : ''
        await p.update({
          collection: 'events',
          id: s.id,
          data: {
            ...propagate,
            ...(startT && sibDate ? { startTime: `${sibDate}${startT}` } : {}),
            ...(endT && sibDate ? { endTime: `${sibDate}${endT}` } : {}),
          },
          overrideAccess: true,
          ...actingAs(currentUser, req),
        })
        futureUpdated++
      }
    }

    return NextResponse.json({ ok: true, futureUpdated, created, seriesId: body.seriesId ?? null })
  } catch (err) {
    console.error('[console/api/events] Update failed:', err)
    const validation = payloadErrorMessage(err)
    if (validation) return NextResponse.json({ error: validation }, { status: 400 })
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
}

/** DELETE /console/api/events/[id] — delete an event (blocks if bookings exist) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const numericId = Number(id)
  const p = await payload()

  // Check for existing bookings
  try {
    const bookingCount = await p.find({
      collection: 'bookings',
      where: { event: { equals: id } },
      limit: 0,
      overrideAccess: true,
    })
    if (bookingCount.totalDocs > 0) {
      return NextResponse.json({
        error: 'has_bookings',
        message: `Cannot delete: ${bookingCount.totalDocs} booking(s) exist for this event. Cancel or reassign them first.`,
      }, { status: 409 })
    }
  } catch (err) {
    console.error('[console/api/events] Booking check failed:', err)
    return NextResponse.json({ error: 'check_failed' }, { status: 500 })
  }

  try {
    await p.delete({
      collection: 'events',
      id: numericId,
      overrideAccess: true,
      ...actingAs(currentUser, req),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[console/api/events] Delete failed:', err)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
}
