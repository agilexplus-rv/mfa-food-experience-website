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
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '30', 10) || 30))

  try {
    const result = await p.find({
      collection: 'media',
      page,
      limit,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })

    const docs = result.docs.map((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = m as any
      return {
        id: doc.id,
        alt: doc.alt || '',
        filename: doc.filename || null,
        filesize: doc.filesize ?? null,
        mimeType: doc.mimeType || null,
        url: doc.url || null,
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
    console.error('[console/api/media] Query failed:', err)
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

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const altText = (formData.get('alt') as string) || ''

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const doc = await p.create({
      collection: 'media',
      data: {
        alt: altText || file.name,
      },
      file: {
        data: buffer,
        mimetype: file.type || 'image/jpeg',
        name: file.name,
        size: file.size,
      },
      overrideAccess: true,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = doc as any
    return NextResponse.json({
      ok: true,
      id: String(d.id),
      url: d.url || null,
      filename: d.filename || null,
    }, { status: 201 })
  } catch (err) {
    console.error('[console/api/media] Upload failed:', err)
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 })
  }
}
