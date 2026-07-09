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
  const status = params.get('status') || undefined
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '25', 10) || 25))

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (status === 'approved') where.approved = { equals: true }
    if (status === 'pending') where.approved = { equals: false }

    const result = await p.find({
      collection: 'testimonials',
      where,
      page,
      limit,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    })

    const docs = result.docs.map((t) => {
      const doc = t as Record<string, unknown>
      const event = doc.event as Record<string, unknown> | null
      return {
        id: doc.id,
        name: doc.name,
        text: doc.text,
        approved: (doc.approved as boolean) ?? false,
        eventId: event?.id || doc.event || null,
        eventTitle: event?.title || null,
        anonymisedAt: doc.anonymisedAt || null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }
    })

    return NextResponse.json({
      docs,
      totalDocs: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
    })
  } catch (err) {
    console.error('[console/api/testimonials] Query failed:', err)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const p = await payload()
  const body = await req.json().catch(() => null)
  if (!body || !body.id || typeof body.approved !== 'boolean') {
    return NextResponse.json({ error: 'id and approved (boolean) are required' }, { status: 400 })
  }

  try {
    await p.update({
      collection: 'testimonials',
      id: body.id,
      data: { approved: body.approved },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[console/api/testimonials] Update failed:', err)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
}
