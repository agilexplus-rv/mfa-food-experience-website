import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { verifySession } from '@/lib/rbac/verify-session'
import { decryptTotpSecret } from '@/lib/mfa/encryption'
import { verifyTotpCode } from '@/lib/mfa/totp'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * POST /api/mfa/verify-setup
 *
 * Verifies a TOTP code during enrollment. If valid, marks mfaEnabled=true.
 */
export async function POST(req: NextRequest) {
  const p = await payload()
  const currentUser = await verifySession(req, p)

  if (!currentUser) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (code.length !== 6 || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: 'Please enter a valid 6-digit code.' },
      { status: 400 },
    )
  }

  const userRecord = await p.findByID({
    collection: 'users',
    id: currentUser.id,
    overrideAccess: true,
  })
  const record = userRecord as Record<string, unknown>

  const encryptedSecret = record.totpSecret as string | undefined
  if (!encryptedSecret) {
    return NextResponse.json(
      { error: 'No TOTP secret found. Start enrollment first.' },
      { status: 400 },
    )
  }

  const secret = decryptTotpSecret(encryptedSecret)
  if (!secret) {
    return NextResponse.json(
      { error: 'Failed to decrypt TOTP secret. Contact administrator.' },
      { status: 500 },
    )
  }

  const isValid = await verifyTotpCode(code, secret)
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid verification code. Please try again.' },
      { status: 400 },
    )
  }

  try {
    await p.update({
      collection: 'users',
      id: currentUser.id,
      data: { mfaEnabled: true },
      overrideAccess: true,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to update MFA status', detail: String(err) },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    message:
      'MFA setup complete. You will need a verification code on next login.',
  })
}
