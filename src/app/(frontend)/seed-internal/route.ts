import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { seed } from '@/payload/seed'

/**
 * POST /seed-internal — Run the seed (idempotent).
 * Called from entrypoint.sh after the server starts.
 */
export async function POST() {
  try {
    const payload = await getPayload({ config })
    await seed(payload)
    return NextResponse.json({ ok: true, version: '2' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Seed API failed:', message)
    return NextResponse.json(
      { ok: false, error: message, version: '2' },
      { status: 500 },
    )
  }
}