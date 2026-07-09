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
  const eventId = params.get('event') || undefined
  const status = params.get('status') || undefined
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '25', 10) || 25))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (eventId) {
    where.event = { equals: eventId }
  }
  if (status) {
    where.status = { equals: status }
  }

  try {
    const result = await p.find({
      collection: 'waitlist',
      where,
      page,
      limit,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    })

    const docs = result.docs.map((doc) => {
      const d = doc as Record<string, unknown>
      const event = d.event as Record<string, unknown> | null
      return {
        id: d.id,
        eventId: event?.id || d.event || null,
        eventTitle: event?.title || null,
        email: d.email,
        name: d.name,
        phone: d.phone || null,
        persons: d.persons || 0,
        status: d.status || 'waiting',
        notifiedAt: d.notifiedAt || null,
        createdAt: d.createdAt,
      }
    })

    return NextResponse.json({
      docs,
      totalDocs: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
    })
  } catch (err) {
    console.error('[console/api/waitlist] Fetch failed:', err)
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
  }
}
