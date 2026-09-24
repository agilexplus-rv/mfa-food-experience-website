/**
 * MFA session token handling.
 *
 * After successful password login, users with mfaEnabled=true receive a
 * short-lived (5-minute) MFA session token as an HTTP-only cookie. They must
 * present a valid TOTP code + this token to complete authentication.
 *
 * The token is a JWT-like signed payload using jose (already a dependency).
 * It encodes the user ID and collection, and expires in 5 minutes.
 */

import { SignJWT, jwtVerify } from 'jose'

const MFA_PENDING_COOKIE_NAME = 'mfa-pending'
const MFA_VERIFIED_COOKIE_NAME = 'mfa-verified'
const MFA_TOKEN_EXPIRY_SECONDS = 300 // 5 minutes
const MFA_VERIFIED_MAX_AGE = 86400 // 24 hours

interface MfaPendingPayload {
  sub: string // user ID
  collection: string
  role: string
}

function getSecret(): Uint8Array {
  const envSecret = process.env.PAYLOAD_SECRET
  if (!envSecret) {
    throw new Error('PAYLOAD_SECRET must be set for MFA session tokens.')
  }
  return new TextEncoder().encode(envSecret)
}

export async function createMfaPendingToken(
  userId: string,
  collection: string,
  role: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ sub: userId, collection, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(now + MFA_TOKEN_EXPIRY_SECONDS)
    .sign(getSecret())
}

export async function verifyMfaPendingToken(
  token: string,
): Promise<MfaPendingPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as MfaPendingPayload
  } catch {
    return null
  }
}

export async function createMfaVerifiedToken(
  userId: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ sub: userId, mfa: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(now + MFA_VERIFIED_MAX_AGE)
    .sign(getSecret())
}

export const MFA_PENDING_COOKIE = MFA_PENDING_COOKIE_NAME
export const MFA_VERIFIED_COOKIE = MFA_VERIFIED_COOKIE_NAME
export const MFA_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}
