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

/** GET /console/api/services — list all services */
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
      collection: 'services',
      page,
      limit,
      sort: 'order',
      depth: 1,
      overrideAccess: true,
    })

    // Compute event counts per service
    const docs = await Promise.all(
      result.docs.map(async (sv) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = sv as any
        let eventCount = 0
        try {
          const countResult = await p.find({
            collection: 'events',
            where: { service: { equals: s.id } },
            limit: 0,
            overrideAccess: true,
          })
          eventCount = countResult.totalDocs
        } catch { /* best-effort */ }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imagery = s.imagery as any

        return {
          id: s.id,
          name: s.name,
          slug: s.slug,
          visible: s.visible ?? false,
          order: s.order ?? 0,
          eventCount,
          imageryId: imagery?.id || null,
          imageryUrl: imagery?.url || null,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
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
    console.error('[console/api/services] Query failed:', err)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }
}

/** POST /console/api/services — create a new service */
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
  if (!body || !body.name || !body.slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
  }

  try {
    const svc = await p.create({
      collection: 'services',
      data: {
        name: body.name.trim(),
        slug: body.slug.trim().toLowerCase(),
        visible: body.visible ?? false,
        order: body.order ?? 0,
        imagery: body.imageryId || undefined,
      },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true, id: String(svc.id) }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      return NextResponse.json({ error: 'slug_taken', message: 'A service with this slug already exists.' }, { status: 409 })
    }
    console.error('[console/api/services] Create failed:', err)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }
}
