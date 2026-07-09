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

async function getAuthUser(
  req: NextRequest,
  p: Payload,
): Promise<{ id: string | number; role: string } | null> {
  const user = await verifySession(req, p)
  if (!user) return null
  return { id: user.id, role: user.role }
}

export async function GET(req: NextRequest) {
  const p = await payload()
  const currentUser = await getAuthUser(req, p)
  if (!currentUser) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (currentUser.role !== 'admin' && currentUser.role !== 'door_staff') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const params = req.nextUrl.searchParams
  const q = params.get('q')?.trim() || undefined
  const status = params.get('status') || undefined
  const eventId = params.get('event') || undefined
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '25', 10) || 25))

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
      depth: 2, // need checkInStaff relationship populated
      overrideAccess: true,
    })
    const isAdmin = currentUser.role === 'admin'
    const docs = result.docs.map((b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const booking = b as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = booking.event as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const staff = booking.checkInStaff as any

      // Door-staff: restricted view — no financial fields
      const base = {
        id: booking.id,
        reference: booking.reference,
        eventTitle: event?.title || null,
        leadAttendeeName: booking.leadAttendeeName,
        email: booking.email,
        persons: booking.persons,
        status: booking.status,
        checkedInAt: booking.checkedInAt || null,
        createdAt: booking.createdAt,
        // Phase 6 scope 5: staff accountability column
        checkInStaffName: staff?.email || null,
      }

      if (isAdmin) {
        return {
          ...base,
          totalAmount: booking.totalAmount,
        }
      }
      return base
    })
    return NextResponse.json({
      docs,
      totalDocs: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
    })
  } catch (err) {
    console.error('[bookings/search] Query failed:', err)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }
}
