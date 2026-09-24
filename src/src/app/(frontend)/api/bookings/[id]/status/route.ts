import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

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
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
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
