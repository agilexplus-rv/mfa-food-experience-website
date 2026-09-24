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
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '25', 10) || 25))

  try {
    const result = await p.find({
      collection: 'policies',
      page,
      limit,
      sort: 'title',
      depth: 0,
      overrideAccess: true,
    })

    const docs = result.docs.map((pol) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = pol as any
      return {
        id: doc.id,
        slug: doc.slug,
        title: doc.title,
        body: doc.body,
        version: doc.version || null,
        reviewedAt: doc.reviewedAt || null,
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
    console.error('[console/api/policies] Query failed:', err)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }
}
