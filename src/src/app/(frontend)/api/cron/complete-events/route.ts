import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { cronSecret } from '@/lib/env'

/**
 * GET /api/cron/complete-events -- Vercel Cron (see vercel.json) runs
 * this daily to transition past events from scheduled -> completed
 * (Rudie 2026-07-12).
 *
 * Rules:
 *   - Only 'scheduled' events are touched. 'cancelled' is a terminal,
 *     user-set state and is NEVER changed by automation; 'completed'
 *     is already done.
 *   - An event is completed when its DATE is strictly before today
 *     (Europe/Malta calendar date) -- i.e. the event day has fully
 *     passed. Same-day events are left alone until the next run, so an
 *     evening event is never marked completed mid-afternoon by a
 *     timezone edge.
 *   - Works identically for one-off events and recurring-series
 *     occurrences, since every occurrence is an independent row --
 *     each flips on its own date, exactly the per-occurrence behaviour
 *     requested.
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

  // Today's date in Malta (the events' operational timezone). en-CA
  // locale formats as YYYY-MM-DD, matching the events.date column.
  const todayMalta = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Malta',
  }).format(new Date())

  try {
    const stale = await p.find({
      collection: 'events',
      where: {
        and: [
          { status: { equals: 'scheduled' } },
          { date: { less_than: todayMalta } },
        ],
      },
      limit: 500,
      overrideAccess: true,
    })

    let completed = 0
    for (const ev of stale.docs) {
      await p.update({
        collection: 'events',
        id: (ev as { id: string | number }).id,
        data: { status: 'completed' },
        overrideAccess: true,
      })
      completed++
    }

    return NextResponse.json({ ok: true, completed, cutoffDate: todayMalta })
  } catch (err) {
    console.error('[cron/complete-events] Failed:', err)
    return NextResponse.json({ error: 'sweep_failed' }, { status: 500 })
  }
}
