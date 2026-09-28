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
    // Until the policy is first saved, Payload fills in the drafted default body.
    const policy = await p.findGlobal({
      slug: 'data-protection-policy',
      overrideAccess: true,
    })
    return NextResponse.json({ policy })
  } catch (err) {
    console.error('[console/api/data-protection-policy] Fetch failed:', err)
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

  let body: Record<string, unknown> | null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  // Only the rich-text body is edited from the console, and it must be a
  // Lexical editor state. Payload's `required` check rejects an empty one.
  const content = body?.body
  const root = (content as { root?: { children?: unknown } } | null | undefined)?.root
  if (!root || !Array.isArray(root.children)) {
    return NextResponse.json({ error: 'Policy content is missing or invalid.' }, { status: 400 })
  }

  try {
    const updated = await p.updateGlobal({
      slug: 'data-protection-policy',
      data: { body: content },
      overrideAccess: true,
      ...actingAs(currentUser, req),
    })
    return NextResponse.json({ ok: true, policy: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'update_failed'
    console.error('[console/api/data-protection-policy] Update failed:', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
