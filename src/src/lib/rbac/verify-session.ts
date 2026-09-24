import { jwtVerify } from 'jose'
import type { Payload } from 'payload'
import type { NextRequest } from 'next/server'

/**
 * Verifies the Payload session cookie for API routes that need
 * authenticated + role-gated access outside Payload's own REST/admin
 * surface (e.g. the door-staff check-in and bookings-management APIs).
 *
 * IMPORTANT: this exists instead of payload.auth() because, in this
 * Payload version/config, payload.auth({ headers, canSetHeaders:false })
 * called from a Next.js Route Handler consistently returns
 * `{ user: null }` even for a genuinely valid, freshly-issued session
 * cookie -- confirmed via direct instrumentation of both this route and
 * Payload's own JWTAuthentication strategy (node_modules/payload/dist/
 * auth/strategies/jwt.js): the manual JWT-decode path in that file never
 * executes when called via payload.auth() from here, and the resulting
 * authResult consistently reports `user: null` while carrying a fully
 * resolved permissions object -- i.e. the call succeeds structurally but
 * the auth strategy resolution itself does not surface a user for this
 * calling context. This was not resolved further due to time; if
 * upgrading Payload or its Next.js integration, re-test payload.auth()
 * directly and prefer it over this workaround if it starts working.
 *
 * This performs the SAME verification Payload's own JWT strategy does:
 * 1. Extract the `${cookiePrefix}-token` cookie (default "payload-token").
 * 2. Verify its signature against PAYLOAD_SECRET using `jose` -- this is
 *    the critical step; never trust a decoded-but-unverified JWT, since
 *    an unverified decode is trivially forgeable (attacker sets `id`/
 *    `role` claims directly). This mirrors payload/dist/auth/strategies/
 *    jwt.js's own `jwtVerify(token, secretKey)` call exactly.
 * 3. Re-fetch the user by the verified `id` claim (never trust email/
 *    role claims baked into the token -- always re-read current state).
 * 4. If the collection uses sessions (Payload's default), verify the
 *    token's `sid` claim matches an active session on the user record --
 *    this lets a logout / session revoke actually invalidate a token
 *    before its exp, rather than relying on expiry alone.
 */
export async function verifySession(
  req: NextRequest,
  p: Payload,
): Promise<{ id: string | number; email: string; role: string } | null> {
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

  let user: { id: string | number; email: string; role?: string; sessions?: { id: string }[] } | null
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

  // Session check (Users collection uses Payload's default useSessions: true).
  const sessions = user.sessions || []
  const hasMatchingSession = sessions.some((s) => s.id === decoded.sid)
  if (!decoded.sid || !hasMatchingSession) return null

  return {
    id: user.id,
    email: user.email,
    role: user.role || 'door_staff',
  }
}
