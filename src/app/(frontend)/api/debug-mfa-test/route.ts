import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

// TEMPORARY diagnostic route -- to be removed immediately after use.
// Reproduces the exact payload.update() call the /api/mfa/enroll
// route makes, but surfaces the full error message/stack instead of
// swallowing it into a generic "Failed to store TOTP secret".
export async function GET() {
  try {
    const payload = await getPayload({ config })
    const result = await payload.update({
      collection: 'users',
      id: 2,
      data: { totpSecret: 'debug-test-value-1234567890abcdef' },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, id: result.id })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      name: err instanceof Error ? err.name : undefined,
    }, { status: 500 })
  }
}
