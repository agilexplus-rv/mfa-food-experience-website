import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { actingAs } from '@/lib/audit/helper'

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
  try {
    const settings = await p.findGlobal({
      slug: 'site-settings',
      overrideAccess: true,
    })
    return NextResponse.json({ settings })
  } catch (err) {
    console.error('[console/api/site-settings] Fetch failed:', err)
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
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

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  // Allowlist + coerce: the console posts the media id as a string, which
  // the integer relationship column rejects ("The following field is
  // invalid: Hero background image").
  const data: Record<string, unknown> = {}
  if ('heroBackgroundImage' in body) {
    const raw = body.heroBackgroundImage
    if (raw === null || raw === '' || raw === undefined) {
      data.heroBackgroundImage = null
    } else {
      const id = Number(typeof raw === 'object' ? (raw as { id?: unknown }).id : raw)
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: 'Invalid hero background image.' }, { status: 400 })
      }
      data.heroBackgroundImage = id
    }
  }
  if ('contactFormRecipients' in body) {
    data.contactFormRecipients = typeof body.contactFormRecipients === 'string' ? body.contactFormRecipients.trim() : null
  }

  try {
    const updated = await p.updateGlobal({
      slug: 'site-settings',
      data,
      overrideAccess: true,
      ...actingAs(currentUser, req),
    })
    return NextResponse.json({ ok: true, settings: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'update_failed'
    console.error('[console/api/site-settings] Update failed:', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
