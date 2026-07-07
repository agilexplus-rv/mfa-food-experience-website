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

async function getAuthUser(
  req: NextRequest,
  p: Payload,
): Promise<{ id: string | number; role: string } | null> {
  const user = await verifySession(req, p)
  if (!user) return null
  return { id: user.id, role: user.role }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const p = await payload()

  const currentUser = await getAuthUser(req, p)
  if (!currentUser) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const booking = await p
    .findByID({ collection: 'bookings', id, overrideAccess: true })
    .catch(() => null)

  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const b = booking as { id: string | number; reference: string; status: string }

  if (b.status === 'cancelled') {
    return NextResponse.json(
      { error: 'already_cancelled', reference: b.reference },
      { status: 409 },
    )
  }

  await p.update({
    collection: 'bookings',
    id,
    data: { status: 'cancelled' },
    overrideAccess: true,
  })

  let body: unknown
  let reason: string | undefined
  try {
    body = await req.json()
    reason =
      typeof (body as Record<string, unknown>)?.reason === 'string'
        ? (body as { reason: string }).reason
        : undefined
  } catch { /* no body */ }

  await p.create({
    collection: 'audit_logs',
    data: {
      action: 'update',
      actor: currentUser.id as string,
      collection: 'bookings',
      documentId: String(id),
      detail: `Cancelled ${b.reference}${reason ? `: ${reason}` : ''}`,
    },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true, reference: b.reference, status: 'cancelled' })
}
