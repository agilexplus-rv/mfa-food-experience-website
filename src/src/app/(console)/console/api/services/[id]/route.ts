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

/** PATCH /console/api/services/[id] — update a service */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  try {
    await p.update({
      collection: 'services',
      id,
      data: body,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      return NextResponse.json({ error: 'slug_taken', message: 'A service with this slug already exists.' }, { status: 409 })
    }
    console.error('[console/api/services] Update failed:', err)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
}

/** DELETE /console/api/services/[id] — delete a service (blocks if events reference it) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const p = await payload()

  // Check for referencing events
  try {
    const eventCount = await p.find({
      collection: 'events',
      where: { service: { equals: id } },
      limit: 0,
      overrideAccess: true,
    })
    if (eventCount.totalDocs > 0) {
      return NextResponse.json({
        error: 'has_events',
        message: `Cannot delete: ${eventCount.totalDocs} event(s) reference this service. Reassign or delete the events first.`,
      }, { status: 409 })
    }
  } catch (err) {
    console.error('[console/api/services] Event check failed:', err)
    return NextResponse.json({ error: 'check_failed' }, { status: 500 })
  }

  try {
    await p.delete({
      collection: 'services',
      id,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[console/api/services] Delete failed:', err)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
}
