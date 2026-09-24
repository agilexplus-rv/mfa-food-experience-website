import { NextRequest, NextResponse } from 'next/server'

import { releaseSeatHold } from '@/lib/bookings/seat-holds'

/**
 * DELETE /api/holds/[id] -- release a hold early (ADR-002: "the
 * frontend's countdown reaching zero calls a DELETE /api/holds/:id
 * endpoint"). Also used when a visitor abandons the booking form.
 * Idempotent -- releasing an already-expired/released hold is a
 * successful no-op.
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const result = await releaseSeatHold(id)
  return NextResponse.json(result, { status: 200 })
}
