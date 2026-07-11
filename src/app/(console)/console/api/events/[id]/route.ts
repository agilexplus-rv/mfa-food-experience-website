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
  const p = await payload()

  try {
    const ev = await p.findByID({
      collection: 'events',
      id,
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
  const p = await payload()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

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

  try {
    const current = await p.findByID({
      collection: 'events',
      id,
      overrideAccess: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any

    await p.update({
      collection: 'events',
      id,
      data: body,
      overrideAccess: true,
    })

    let futureUpdated = 0
    if (applyTo === 'future' && current?.seriesId) {
      // Fields that make sense to propagate. Explicit allowlist so a
      // stray date/id field can never clobber sibling occurrences.
      const timeOf = (dt: unknown): string | null =>
        typeof dt === 'string' && dt.includes('T') ? dt.slice(dt.indexOf('T')) : null
      const propagate: Record<string, unknown> = {}
      for (const k of ['title', 'service', 'capacity', 'pricePerPerson', 'locationRef', 'status', 'fullyBookedOverride']) {
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
        })
        futureUpdated++
      }
    }

    return NextResponse.json({ ok: true, futureUpdated })
  } catch (err) {
    console.error('[console/api/events] Update failed:', err)
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
      id,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[console/api/events] Delete failed:', err)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
}
