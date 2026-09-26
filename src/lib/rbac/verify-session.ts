import { jwtVerify } from 'jose'
import type { Payload } from 'payload'
import type { NextRequest } from 'next/server'
import { verifyMfaVerifiedToken } from '@/lib/mfa/session'

/**
 * Verifies the Payload session cookie AND (by default) the MFA-verified
 * cookie for API routes that need authenticated + role-gated access outside
 * Payload's own REST/admin surface (e.g. the door-staff check-in and
 * bookings-management APIs).
 *
 * MFA enforcement: when the user has mfaEnabled === true, the caller must
 * present a valid `mfa-verified` JWT cookie (issued by the TOTP verify
 * endpoint after successful TOTP code entry). Without it, the session is
 * treated as unauthenticated — only the MFA enrolment/setup endpoints pass
 * `skipMfaCheck: true` to allow the user to complete MFA setup before they
 * have the mfa-verified cookie.
 *
 * All other callers (console API, check-in API, account API, etc.) get the
 * default `skipMfaCheck: false` for defence in depth.
 *
 * This exists instead of payload.auth() because, in this Payload
 * version/config, payload.auth({ headers, canSetHeaders:false }) called from
 * a Next.js Route Handler consistently returns `{ user: null }` even for a
 * genuinely valid, freshly-issued session cookie.
 */
export async function verifySession(
  req: NextRequest,
  p: Payload,
  skipMfaCheck = false,
): Promise<{ id: string | number; email: string; role: string; mfaEnabled: boolean } | null> {
  const cookiePrefix = p.config.cookiePrefix || 'payload'
  const token = req.cookies.get(`${cookiePrefix}-token`)?.value
  if (!token) return null

  let decoded: { id?: string | number; collection?: string; sid?: string }
  try {
    const secretKey = new TextEncoder().encode(p.secret)
    const { payload: verifiedPayload } = await jwtVerify(token, secretKey)
    decoded = verifiedPayload as typeof decoded
  } catch {
    // Invalid signature, expired, or malformed -- reject.
    return null
  }

  if (!decoded.id || decoded.collection !== 'users') return null

  let user: {
    id: string | number
    email: string
    role?: string
    mfaEnabled?: boolean
    sessions?: { id: string }[]
  } | null
  try {
    const result = await p.findByID({
      collection: 'users',
      id: decoded.id,
      overrideAccess: true,
    })
    user = result as typeof user
  } catch {
    return null
  }
  if (!user) return null

  // Session check (only when the collection uses Payload's useSessions: true).
  // When useSessions is false, the JWT has no `sid` claim — skip the check.
  if (decoded.sid) {
    const sessions = user.sessions || []
    const hasMatchingSession = sessions.some((s) => s.id === decoded.sid)
    if (!hasMatchingSession) return null
  }

  // MFA enforcement (defence in depth — also checked in middleware for pages).
  // Skip only for the MFA enrolment/verification endpoints themselves.
  if (!skipMfaCheck && user.mfaEnabled === true) {
    const verifiedCookie = req.cookies.get('mfa-verified')?.value
    const mfaOk = await verifyMfaVerifiedToken(verifiedCookie, String(user.id))
    if (!mfaOk) return null
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role || 'door_staff',
    mfaEnabled: user.mfaEnabled === true,
  }
}