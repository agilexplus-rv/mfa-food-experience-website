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
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Seed API failed:', err)
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    )
  }
}