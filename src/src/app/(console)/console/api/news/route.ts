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
      collection: 'news_items',
      page,
      limit,
      sort: '-date',
      depth: 1,
      overrideAccess: true,
    })

    const docs = result.docs.map((n) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = n as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const image = doc.image as any
      return {
        id: doc.id,
        title: doc.title,
        date: doc.date,
        slug: doc.slug,
        published: (doc.published as boolean) ?? false,
        body: doc.body,
        imageId: image?.id || null,
        imageUrl: image?.url || null,
        imageAlt: image?.alt || null,
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
    console.error('[console/api/news] Query failed:', err)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }
}

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
  if (!body || !body.title || !body.slug) {
    return NextResponse.json({ error: 'title and slug are required' }, { status: 400 })
  }

  const defaultBody = {
    root: {
      children: [{ children: [{ type: 'text', text: '', format: 0 }], type: 'paragraph' }],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }

  try {
    const doc = await p.create({
      collection: 'news_items',
      data: {
        title: body.title.trim(),
        slug: body.slug.trim().toLowerCase(),
        date: body.date || new Date().toISOString(),
        body: body.body || defaultBody,
        published: body.published ?? false,
        image: body.imageId || undefined,
      },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true, id: String(doc.id) }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      return NextResponse.json({ error: 'slug_taken', message: 'A news item with this slug already exists.' }, { status: 409 })
    }
    console.error('[console/api/news] Create failed:', err)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }
}
