import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /health/ready — readiness: can this instance actually serve requests?
 *
 * WHY THIS EXISTS (incident 2026-11-04): `/health` is a liveness probe — it
 * does not touch the database. During the outage it answered 200 continuously
 * while every database-backed route hung or returned 500, so a total outage
 * looked healthy to anything watching. That is worse than having no health
 * endpoint at all.
 *
 * So `/health` keeps meaning "the process is up" (the container entrypoint uses
 * it to decide when Node has booted, so it must stay database-free), and this
 * route means "and I can reach the database". Point uptime monitoring and
 * deploy smoke tests at this one.
 *
 * Uses Payload's own connection pool rather than importing `pg` directly: `pg`
 * is only a transitive dependency of @payloadcms/db-postgres, so importing it
 * here works locally through hoisting but fails stricter builds (it broke the
 * Vercel build on Node 26). Going through Payload also means the probe uses the
 * same pool real requests do.
 */

export const dynamic = 'force-dynamic'

/** Hard ceiling so a wedged database cannot turn the probe itself into a hang. */
const TIMEOUT_MS = 2500

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`readiness check timed out after ${ms}ms`)), ms),
    ),
  ])
}

export async function GET() {
  const started = Date.now()

  try {
    const payload = await getPayload({ config })
    const db = payload.db as unknown as {
      pool?: { query: (sql: string) => Promise<unknown> }
    }

    if (!db?.pool || typeof db.pool.query !== 'function') {
      return NextResponse.json(
        { status: 'unready', reason: 'no_db_pool' },
        { status: 503 },
      )
    }

    await withTimeout(db.pool.query('select 1'), TIMEOUT_MS)
    return NextResponse.json({ status: 'ready', dbMs: Date.now() - started })
  } catch (err) {
    // Distinguish "cannot reach it" from "it refuses me": both are 503, but the
    // reason is what tells an operator which runbook to follow. 28P01 is the
    // password-mismatch signature from the 2026-11-04 incident.
    const message = err instanceof Error ? err.message : 'unknown error'
    const reason = /password authentication failed/i.test(message)
      ? 'authentication_failed'
      : /timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(message)
        ? 'unreachable'
        : 'query_failed'

    console.error('[health/ready] not ready:', reason, message)
    return NextResponse.json(
      { status: 'unready', reason, dbMs: Date.now() - started },
      { status: 503 },
    )
  }
}
