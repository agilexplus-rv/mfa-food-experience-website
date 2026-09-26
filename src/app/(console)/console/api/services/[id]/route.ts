import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { actingAs } from '@/lib/audit/helper'
import { payloadErrorMessage } from '@/lib/api-errors'

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
  const numericId = Number(id)
  const p = await payload()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  // Allowlist fields and coerce the media relationship: forwarding the raw
  // body passed `imagery: "12"` (a string) straight to Drizzle, whose
  // integer column rejects it -- so linking an existing image failed.
  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string') data.name = body.name.trim()
  if (typeof body.slug === 'string') data.slug = body.slug.trim().toLowerCase()
  if (typeof body.visible === 'boolean') data.visible = body.visible
  if (body.order !== undefined) data.order = Number(body.order) || 0
  if (body.description !== undefined) data.description = body.description && typeof body.description === 'object' ? body.description : null
  if ('imageryId' in body || 'imagery' in body) {
    const raw = 'imageryId' in body ? body.imageryId : body.imagery
    if (raw === null || raw === undefined || raw === '') {
      data.imagery = null
    } else {
      const imageryId = Number(typeof raw === 'object' ? raw.id : raw)
      if (!Number.isFinite(imageryId)) {
        return NextResponse.json({ error: 'invalid_imagery' }, { status: 400 })
      }
      data.imagery = imageryId
    }
  }

  try {
    await p.update({
      collection: 'services',
      id: numericId,
      data,
      overrideAccess: true,
      ...actingAs(currentUser, req),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      return NextResponse.json({ error: 'slug_taken', message: 'A service with this slug already exists.' }, { status: 409 })
    }
    console.error('[console/api/services] Update failed:', err)
    const validation = payloadErrorMessage(err)
    if (validation) return NextResponse.json({ error: validation }, { status: 400 })
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
  const numericId = Number(id)
  const p = await payload()

  // Check for referencing events
  try {
    const eventCount = await p.find({
      collection: 'events',
      where: { service: { equals: numericId } },
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
      id: numericId,
      overrideAccess: true,
      ...actingAs(currentUser, req),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[console/api/services] Delete failed:', err)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
}
