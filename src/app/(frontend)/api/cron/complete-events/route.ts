import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { cronSecret } from '@/lib/env'
import { completeFinishedEvents } from '@/lib/events/auto-close'

/**
 * GET /api/cron/complete-events -- transitions finished events from
 * scheduled -> completed once their calendar day has passed (see
 * completeFinishedEvents for the rule).
 *
 * The same sweep also runs in-process every 15 minutes (see
 * src/instrumentation.ts), so auto-close works without an external
 * scheduler; this endpoint remains for manual / external triggering.
 *
 * Auth: same shared-secret pattern as the other cron routes.
 */
export async function GET(req: NextRequest) {
  const expected = cronSecret()
  if (expected) {
    const authHeader = req.headers.get('authorization')
    const customHeader = req.headers.get('x-cron-secret')
    if (authHeader !== `Bearer ${expected}` && customHeader !== expected) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  } else {
    console.warn('[cron/complete-events] CRON_SECRET is not set -- endpoint is unauthenticated.')
  }

  const p = await getPayload({ config })

  try {
    const result = await completeFinishedEvents(p)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/complete-events] Failed:', err)
    return NextResponse.json({ error: 'sweep_failed' }, { status: 500 })
  }
}
