import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { verifySession } from '@/lib/rbac/verify-session'
import { encryptTotpSecret } from '@/lib/mfa/encryption'
import { generateTotpSecret, buildTotpUri } from '@/lib/mfa/totp'
import { verifyMfaVerifiedToken, MFA_VERIFIED_COOKIE } from '@/lib/mfa/session'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * POST /api/mfa/enroll
 *
 * Generates a new TOTP secret for the authenticated user, stores it encrypted,
 * and returns a QR-code otpauth URI + manual entry key.
 */
export async function POST(req: NextRequest) {
  const p = await payload()
  const currentUser = await verifySession(req, p)

  if (!currentUser) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // A password-only session must not be able to replace an existing TOTP
  // secret -- otherwise it could enroll its own authenticator and then pass
  // verify-setup, bypassing 2FA. Re-enrollment requires proof of the
  // current second factor.
  if (
    currentUser.mfaEnabled &&
    !(await verifyMfaVerifiedToken(
      req.cookies.get(MFA_VERIFIED_COOKIE)?.value,
      String(currentUser.id),
    ))
  ) {
    return NextResponse.json(
      { error: 'Two-factor verification required to re-enroll. Log in again.' },
      { status: 403 },
    )
  }

  const secret = generateTotpSecret()
  const qrUri = buildTotpUri(currentUser.email, secret)
  const encrypted = encryptTotpSecret(secret)

  try {
    await p.update({
      collection: 'users',
      id: currentUser.id,
      data: { totpSecret: encrypted },
      overrideAccess: true,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to store TOTP secret', detail: String(err) },
      { status: 500 },
    )
  }

  return NextResponse.json({
    qrUri,
    manualKey: secret,
    message:
      'Scan the QR code or enter the key manually in your authenticator app, then verify.',
  })
}
