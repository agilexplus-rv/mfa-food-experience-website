import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { auditLog, clientMeta } from '@/lib/audit/helper'

/** Used when the site-settings value is missing or invalid (matches the field default). */
const DEFAULT_RETENTION_MONTHS = 6

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

/**
 * POST /console/api/waitlist/cleanup — expire waitlist entries whose
 * createdAt is older than the retention period in Site Settings
 * (waitlistRetentionMonths). Called by the console waitlist page on load
 * and from its "Clean up expired" button.
 *
 * Idempotent: entries that are already expired are left alone, so a
 * repeat run returns { cleaned: 0 }.
 */
export async function POST(req: NextRequest) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const p = await payload()

  let retentionMonths = DEFAULT_RETENTION_MONTHS
  try {
    const settings = (await p.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })) as {
      waitlistRetentionMonths?: number | null
    }
    const n = Number(settings.waitlistRetentionMonths)
    // Same bounds as the field (1-36), in case the stored value predates them.
    if (Number.isFinite(n) && n >= 1) retentionMonths = Math.min(36, Math.floor(n))
  } catch (err) {
    console.warn('[console/api/waitlist/cleanup] Could not read site settings, using the default:', err)
  }

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - retentionMonths)

  try {
    const result = await p.update({
      collection: 'waitlist',
      where: {
        and: [
          { createdAt: { less_than: cutoff.toISOString() } },
          { status: { not_equals: 'expired' } },
        ],
      },
      data: { status: 'expired', expiredAt: new Date().toISOString() },
      overrideAccess: true,
    })
    if (result.errors.length > 0) {
      console.error('[console/api/waitlist/cleanup] Some entries could not be expired:', result.errors)
    }

    const cleaned = result.docs.length
    // One summary entry per run (not one per row, and none when nothing changed).
    if (cleaned > 0) {
      auditLog(p, {
        action: 'update',
        actor: currentUser.id,
        collection: 'waitlist',
        documentId: 'cleanup',
        detail: `Expired ${cleaned} waitlist entr${cleaned === 1 ? 'y' : 'ies'} older than ${retentionMonths} month${retentionMonths === 1 ? '' : 's'}`,
        changes: { expiredIds: result.docs.map((d) => (d as { id: string | number }).id) },
        ...clientMeta(req),
      })
    }

    return NextResponse.json({ cleaned, retentionMonths, cutoff: cutoff.toISOString() })
  } catch (err) {
    console.error('[console/api/waitlist/cleanup] Cleanup failed:', err)
    return NextResponse.json({ error: 'cleanup_failed' }, { status: 500 })
  }
}
