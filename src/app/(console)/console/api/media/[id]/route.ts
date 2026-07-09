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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    // Block delete if media is referenced by any service or news item
    const refChecks: { collection: string; field: string }[] = [
      { collection: 'services', field: 'imagery' },
      { collection: 'news_items', field: 'image' },
    ]

    for (const check of refChecks) {
      const refResult = await p.find({
        collection: check.collection,
        where: { [check.field]: { equals: id } },
        limit: 1,
        overrideAccess: true,
      })
      if (refResult.totalDocs > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = refResult.docs[0] as any
        return NextResponse.json({
          error: 'referenced',
          message: `This media is still referenced by a ${check.collection === 'services' ? 'service' : 'news item'} (${doc.title || doc.name || 'untitled'}). Remove the reference first.`,
        }, { status: 409 })
      }
    }

    await p.delete({
      collection: 'media',
      id,
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((err as any)?.error === 'referenced') throw err
    console.error('[console/api/media] Delete failed:', err)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
}
