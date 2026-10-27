import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { seed } from '@/payload/seed'
import { seedTokenOk } from '@/lib/seed-token'

/**
 * POST /seed-internal: Run the seed (idempotent).
 * Called from entrypoint.sh after the server starts, with the per-start key
 * in x-seed-token. Without the right key it answers 404, as if it did not
 * exist, and never runs the seed.
 */
export async function POST(request: Request) {
  if (!seedTokenOk(request.headers.get('x-seed-token'), process.env.SEED_INTERNAL_TOKEN)) {
    return new NextResponse(null, { status: 404 })
  }
  try {
    const payload = await getPayload({ config })
    await seed(payload)
    return NextResponse.json({ ok: true, version: '2' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Seed API failed:', message)
    // The detail stays in the server log, not in the response.
    return NextResponse.json({ ok: false, version: '2' }, { status: 500 })
  }
}
