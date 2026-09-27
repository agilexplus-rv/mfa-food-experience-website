import { NextRequest, NextResponse } from 'next/server'

import { releaseSeatHold } from '@/lib/bookings/seat-holds'
import { createRateLimiter, getClientIp, isSameOriginRequest } from '@/lib/rate-limit'

/**
 * DELETE /api/holds/[id]?sessionId=... -- release a hold early (ADR-002:
 * "the frontend's countdown reaching zero calls a DELETE /api/holds/:id
 * endpoint"). Also used when a visitor abandons the booking form or
 * changes the seat count.
 *
 * The caller must present the cart `sessionId` the hold was created with:
 * hold ids are sequential integers, so an unauthenticated DELETE by id
 * alone would let anyone release other visitors' reservations.
 *
 * Idempotent -- releasing an already-expired/released hold is a
 * successful no-op.
 */
const rateLimiter = createRateLimiter({ windowMs: 60_000, max: 60 })

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  rateLimiter.maybeCleanup()
  if (!rateLimiter.check(getClientIp(req))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: 'cross_origin_rejected' }, { status: 403 })
  }

  const { id } = await ctx.params
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }
  const sessionId = req.nextUrl.searchParams.get('sessionId')?.trim()
  if (!sessionId || sessionId.length < 8 || sessionId.length > 200) {
    return NextResponse.json({ error: 'session_required' }, { status: 400 })
  }

  const result = await releaseSeatHold(id, sessionId)
  if (!result.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}
