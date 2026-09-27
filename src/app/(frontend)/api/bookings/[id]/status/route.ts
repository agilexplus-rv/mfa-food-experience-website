import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { createRateLimiter, getClientIp } from '@/lib/rate-limit'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * GET /api/bookings/[id]/status -- polled by the confirmation page
 * every 2s per ADR-004 step 4, until status = 'confirmed'.
 *
 * Deliberately returns only the minimal fields needed by the polling
 * UI (no email/phone/PII) since this endpoint has no auth and the id
 * is guessable-ish (sequential DB ids) -- FR/DPIA data minimisation.
 * Rate-limited so the id space cannot be enumerated in bulk (the polling
 * UI needs at most 1 request / 2 s).
 */
const rateLimiter = createRateLimiter({ windowMs: 60_000, max: 120 })

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  rateLimiter.maybeCleanup()
  if (!rateLimiter.check(getClientIp(req))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const { id } = await ctx.params
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const p = await payload()
  const booking = await p.findByID({ collection: 'bookings', id, overrideAccess: true }).catch(() => null)
  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const b = booking as {
    id: string | number
    reference: string
    status: string
    event: string | number | { id: string | number; title?: string }
    persons: number
    totalAmount: number
  }
  const eventTitle = typeof b.event === 'object' ? b.event.title : undefined

  return NextResponse.json({
    id: b.id,
    reference: b.reference,
    status: b.status,
    persons: b.persons,
    totalAmount: b.totalAmount,
    eventTitle,
  })
}
