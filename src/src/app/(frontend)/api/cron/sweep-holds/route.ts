import { NextRequest, NextResponse } from 'next/server'

import { sweepExpiredHolds } from '@/lib/bookings/seat-holds'
import { cronSecret } from '@/lib/env'

/**
 * GET /api/cron/sweep-holds -- Vercel Cron hits this on a schedule
 * (see vercel.json) to delete expired seat_holds rows (ADR-002's TTL
 * sweeper -- "safety net for abandoned browser sessions").
 *
 * Protected by a shared-secret header since Vercel Cron requests are
 * otherwise unauthenticated. We accept either:
 *   - Authorization: Bearer <CRON_SECRET>  (Vercel Cron's own convention
 *     when CRON_SECRET is set as a project env var)
 *   - x-cron-secret: <CRON_SECRET>          (for manual/local testing)
 */
export async function GET(req: NextRequest) {
  const expected = cronSecret()
  if (expected) {
    const authHeader = req.headers.get('authorization')
    const customHeader = req.headers.get('x-cron-secret')
    const bearerOk = authHeader === `Bearer ${expected}`
    const customOk = customHeader === expected
    if (!bearerOk && !customOk) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  } else {
    // No CRON_SECRET configured yet -- log loudly but do not hard-fail the
    // sweep (holds are non-sensitive: no PII, just event/session/seats/expiry
    // per ADR-002's compliance mapping). This keeps the sweeper functional
    // in the demo environment before the secret is provisioned, while the
    // summary flags CRON_SECRET as an env var that still needs to be set.
    console.warn('[cron/sweep-holds] CRON_SECRET is not set -- endpoint is unauthenticated.')
  }

  const result = await sweepExpiredHolds()
  return NextResponse.json({ ok: true, ...result })
}
