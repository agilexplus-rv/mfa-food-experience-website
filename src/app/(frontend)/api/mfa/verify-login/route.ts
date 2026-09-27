import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { jwtVerify } from 'jose'
import { decryptTotpSecret } from '@/lib/mfa/encryption'
import { verifyTotpCode } from '@/lib/mfa/totp'
import {
  createMfaVerifiedToken,
  MFA_VERIFIED_COOKIE,
  MFA_VERIFIED_COOKIE_OPTIONS,
} from '@/lib/mfa/session'
import { auditLog, clientMeta } from '@/lib/audit/helper'
import { createRateLimiter } from '@/lib/rate-limit'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

// Caps TOTP guesses: 10 attempts per user+IP per 5 minutes.
const limiter = createRateLimiter({ windowMs: 5 * 60_000, max: 10 })

/**
 * POST /api/mfa/verify-login
 *
 * Verifies a TOTP code during login (after Payload password auth).
 * Sets the mfa-verified HttpOnly cookie on success.
 */
export async function POST(req: NextRequest) {
  const p = await payload()
  const cookiePrefix = p.config.cookiePrefix || 'payload'
  const token = req.cookies.get(`${cookiePrefix}-token`)?.value

  if (!token) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let userId: string
  try {
    const secretKey = new TextEncoder().encode(p.secret)
    const { payload: verified } = await jwtVerify(token, secretKey)
    const v = verified as {
      id?: string | number
      collection?: string
    }
    if (!v.id || v.collection !== 'users') {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
    }
    userId = String(v.id)
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }

  limiter.maybeCleanup()
  if (!limiter.check(`${userId}:${clientMeta(req).ipAddress ?? 'unknown'}`)) {
    return NextResponse.json(
      { error: 'Too many attempts. Wait a few minutes and try again.' },
      { status: 429 },
    )
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
    id: userId,
    overrideAccess: true,
  })
  const record = userRecord as Record<string, unknown>

  const encryptedSecret = record.totpSecret as string | undefined
  if (!encryptedSecret) {
    return NextResponse.json(
      { error: 'MFA is not set up for this account.' },
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
    auditLog(p, {
      action: 'login_failed',
      actor: userId,
      collection: 'users',
      documentId: userId,
      detail: `Invalid MFA code entered for ${String(record.email || userId)}`,
      ...clientMeta(req),
    })
    return NextResponse.json(
      { error: 'Invalid verification code. Please try again.' },
      { status: 400 },
    )
  }

  const verifiedToken = await createMfaVerifiedToken(userId)
  // Door staff can't access the admin console -- send them to their dashboard.
  const home = record.role === 'admin' ? '/console' : '/dashboard'
  const response = NextResponse.json({ success: true, redirect: home })
  response.cookies.set(MFA_VERIFIED_COOKIE, verifiedToken, MFA_VERIFIED_COOKIE_OPTIONS)
  return response
}
