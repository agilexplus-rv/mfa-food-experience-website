import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { reconcileVivaPayment } from '@/lib/bookings/reconcile-viva'
import { getOrderTransactions } from '@/lib/viva/client'
import { cronSecret, isVivaConfigured } from '@/lib/env'

/**
 * GET /api/cron/reconcile-viva -- safety net behind the VIVA webhook.
 *
 * The webhook is the primary way a paid booking flips pending -> confirmed.
 * The confirmation page can also reconcile, but only while the customer still
 * has the tab open. Neither covers the case where the notification is dropped
 * and the visitor closes the page: the money is taken and nothing on our side
 * notices.
 *
 * This endpoint sweeps pending VIVA bookings that are old enough to have been
 * paid but not yet confirmed, asks VIVA for the order's transactions, and --
 * when it finds a completed one -- finalises through the SAME path as the
 * webhook (same order-code, amount and one-transaction-one-booking guards).
 * So the sweep can never confirm anything a real payment would not have.
 *
 * Safety:
 * - Only touches bookings still in 'pending'.
 * - A VIVA lookup failure is logged and skipped, never fatal: the run carries
 *   on and the next run retries.
 * - Bounded batch size so one sweep cannot run away.
 *
 * Protected by the shared CRON_SECRET, accepting either the Vercel-style
 * `Authorization: Bearer` header or `x-cron-secret` (the Container App jobs
 * send the latter).
 */

const BATCH = 50
/** Ignore bookings younger than this: the customer may still be paying. */
const MIN_AGE_MS = 90_000
/** Stop looking after this: older pending rows are a manual problem, not a sweep. */
const MAX_AGE_MS = 24 * 3_600_000

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

interface PendingRow {
  id: string | number
  reference?: string
  vivaOrderCode?: string | null
  createdAt?: string | null
}

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
    console.warn('[cron/reconcile-viva] CRON_SECRET is not set -- endpoint is unauthenticated.')
  }

  if (!isVivaConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'viva_not_configured' })
  }

  const p = await payload()
  const now = Date.now()

  let rows: PendingRow[] = []
  try {
    const res = await p.find({
      collection: 'bookings',
      where: {
        and: [
          { status: { equals: 'pending' } },
          { vivaOrderCode: { exists: true } },
          { createdAt: { less_than: new Date(now - MIN_AGE_MS).toISOString() } },
          { createdAt: { greater_than: new Date(now - MAX_AGE_MS).toISOString() } },
        ],
      },
      limit: BATCH,
      depth: 0,
      overrideAccess: true,
    })
    rows = res.docs as unknown as PendingRow[]
  } catch (err) {
    console.error('[cron/reconcile-viva] Query failed:', err)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }

  const summary = { scanned: rows.length, confirmed: 0, stillPending: 0, unresolved: 0, errors: 0 }

  for (const row of rows) {
    const orderCode = row.vivaOrderCode
    if (!orderCode) continue
    try {
      const transactions = await getOrderTransactions(orderCode)
      const completed = transactions.find((t) => t.statusId === 'F' && t.transactionId)
      if (!completed?.transactionId) {
        summary.stillPending++
        continue
      }
      const outcome = await reconcileVivaPayment({
        orderCode,
        transactionId: completed.transactionId,
      })
      if (outcome === 'confirmed') {
        summary.confirmed++
        console.info('[cron/reconcile-viva] Confirmed', row.reference, 'order', orderCode)
      } else {
        summary.stillPending++
        console.info('[cron/reconcile-viva] Not confirmed', row.reference, '->', outcome)
      }
    } catch (err) {
      // A lookup failure is expected (VIVA down, order unknown): log, move on.
      summary.unresolved++
      console.warn('[cron/reconcile-viva] Lookup/reconcile failed for', row.reference, err)
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
