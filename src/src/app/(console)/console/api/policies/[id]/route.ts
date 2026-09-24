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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  if (!body) return NextResponse.json({ error: 'request body required' }, { status: 400 })

  try {
    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = body.title.trim()
    if (body.slug !== undefined) data.slug = body.slug.trim().toLowerCase()
    if (body.version !== undefined) data.version = body.version
    if (body.reviewedAt !== undefined) data.reviewedAt = body.reviewedAt

    // If body is being updated, auto-set reviewedAt to today if not explicitly provided
    if (body.body !== undefined) {
      data.body = body.body
      data.reviewedAt = body.reviewedAt || new Date().toISOString().split('T')[0]
    }

    await p.update({
      collection: 'policies',
      id,
      data,
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      return NextResponse.json({ error: 'slug_taken', message: 'A policy with this slug already exists.' }, { status: 409 })
    }
    // Let through Payload's own error messages (e.g. the beforeChange hook)
    if (msg.includes('reviewedAt')) {
      return NextResponse.json({ error: 'reviewedAt_required', message: msg }, { status: 400 })
    }
    console.error('[console/api/policies] Update failed:', err)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
}
