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

/** GET /console/api/bookings — search bookings (admin only) */
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
  const q = params.get('q')?.trim() || undefined
  const status = params.get('status') || undefined
  const eventId = params.get('event') || undefined
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '25', 10) || 25))
  const bookingId = params.get('id') || undefined

  // If specific ID requested, return single booking detail
  if (bookingId) {
    try {
      const booking = await p.findByID({
        collection: 'bookings',
        id: bookingId,
        depth: 2,
        overrideAccess: true,
      })
      if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = booking as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = b.event as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const staff = b.checkInStaff as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coupon = b.coupon as any

      // Fetch audit trail for this booking
      let auditEntries: Array<{ id: string; action: string; detail: string; createdAt: string }> = []
      try {
        const auditResult = await p.find({
          collection: 'audit_logs',
          where: {
            collection: { equals: 'bookings' },
            documentId: { equals: String(bookingId) },
          },
          limit: 50,
          sort: '-createdAt',
          overrideAccess: true,
        })
        auditEntries = auditResult.docs.map((entry) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e = entry as any
          return {
            id: String(e.id),
            action: e.action || '',
            detail: e.detail || '',
            createdAt: e.createdAt || '',
          }
        })
      } catch { /* audit trail is best-effort */ }

      // Fetch waitlist entries for this booking's event
      let waitlistEntries: Array<{ id: string; email: string; name: string; persons: number; status: string; createdAt: string }> = []
      if (event?.id) {
        try {
          const wlResult = await p.find({
            collection: 'waitlist',
            where: { event: { equals: event.id } },
            limit: 100,
            sort: 'createdAt',
            overrideAccess: true,
          })
          waitlistEntries = wlResult.docs.map((w) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const we = w as any
            return {
              id: String(we.id),
              email: we.email || '',
              name: we.name || '',
              persons: we.persons || 0,
              status: we.status || 'waiting',
              createdAt: we.createdAt || '',
            }
          })
        } catch { /* waitlist is best-effort */ }
      }

      return NextResponse.json({
        id: b.id,
        reference: b.reference,
        eventId: event?.id || b.event || null,
        eventTitle: event?.title || null,
        eventDate: event?.date || null,
        leadAttendeeName: b.leadAttendeeName,
        email: b.email,
        phone: b.phone || null,
        persons: b.persons,
        language: b.language || 'en',
        status: b.status,
        totalAmount: b.totalAmount,
        checkedInAt: b.checkedInAt || null,
        checkInStaffName: staff?.email || null,
        noShow: b.noShow ?? false,
        refundStatus: b.refundStatus ?? null,
        refundId: b.stripeRefundId || null,
        dietaryNotes: b.dietaryNotes || null,
        dietaryConsent: b.dietaryConsent ?? false,
        paymentMethod: b.paymentMethod || 'stripe',
        couponCode: coupon?.code || null,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        auditTrail: auditEntries,
        waitlistEntries,
      })
    } catch (err) {
      console.error('[console/api/bookings] Detail fetch failed:', err)
      return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
    }
  }

  // Search mode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (q || status || eventId) {
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
    if (eventId) and.push({ event: { equals: eventId } })
    if (and.length > 0) where.and = and
  }

  try {
    const result = await p.find({
      collection: 'bookings',
      where,
      page,
      limit,
      sort: '-createdAt',
      depth: 2,
      overrideAccess: true,
    })
    const docs = result.docs.map((b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const booking = b as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = booking.event as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const staff = booking.checkInStaff as any
      return {
        id: booking.id,
        reference: booking.reference,
        eventId: event?.id || booking.event || null,
        eventTitle: event?.title || null,
        eventDate: event?.date || null,
        leadAttendeeName: booking.leadAttendeeName,
        email: booking.email,
        persons: booking.persons,
        status: booking.status,
        totalAmount: booking.totalAmount,
        checkedInAt: booking.checkedInAt || null,
        checkInStaffName: staff?.email || null,
        noShow: booking.noShow ?? false,
        refundStatus: booking.refundStatus ?? null,
        paymentMethod: booking.paymentMethod || 'stripe',
        createdAt: booking.createdAt,
      }
    })
    return NextResponse.json({
      docs,
      totalDocs: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
    })
  } catch (err) {
    console.error('[console/api/bookings] Search failed:', err)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }
}

/** POST /console/api/bookings — create manual booking (admin only) */
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
  if (!body || !body.eventId || !body.leadAttendeeName || !body.email || !body.persons) {
    return NextResponse.json({ error: 'eventId, leadAttendeeName, email, persons are required' }, { status: 400 })
  }

  const paymentMethod = body.paymentMethod || 'cash'
  if (!['stripe', 'cash', 'bank_transfer', 'comped', 'pending_payment'].includes(paymentMethod)) {
    return NextResponse.json({ error: 'invalid paymentMethod' }, { status: 400 })
  }

  try {
    // Verify event exists
    const event = await p.findByID({
      collection: 'events',
      id: body.eventId,
      overrideAccess: true,
    })
    if (!event) return NextResponse.json({ error: 'event_not_found' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ev = event as any
    const pricePerPerson = ev.pricePerPerson || 0
    let totalAmount: number
    if (body.totalAmount != null && typeof body.totalAmount === 'number') {
      totalAmount = body.totalAmount
    } else if (paymentMethod === 'comped') {
      totalAmount = 0
    } else {
      totalAmount = pricePerPerson * (body.persons || 1)
    }

    // Generate a reference
    const ts = Date.now().toString(36).toUpperCase()
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
    const reference = `MFA-MAN-${ts}-${rand}`

    const booking = await p.create({
      collection: 'bookings',
      data: {
        reference,
        event: body.eventId,
        leadAttendeeName: body.leadAttendeeName,
        email: body.email.toLowerCase().trim(),
        phone: body.phone || undefined,
        persons: body.persons,
        status: 'confirmed',
        language: body.language || 'en',
        totalAmount,
        paymentMethod,
        dietaryNotes: body.dietaryNotes || undefined,
      },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true, id: String(booking.id), reference }, { status: 201 })
  } catch (err) {
    console.error('[console/api/bookings] Create failed:', err)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }
}
