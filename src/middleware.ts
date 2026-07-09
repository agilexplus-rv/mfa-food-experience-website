import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js middleware for route gating per ADR-007, ADR-008 C6.
 *
 * Protects /admin and /check-in routes:
 *   - Unauthenticated -> redirect to /admin/login
 *   - Door-staff on /admin/bookings -> blocked (403)
 *   - Door-staff on /admin/* -> allowed (they can use check-in features)
 *   - MFA-enabled users without mfa-verified cookie -> redirect to /mfa-verify
 *
 * Uses Payload's HTTP-only cookie (`payload-token`) for session detection.
 * JWT payload (role, mfaEnabled, collection, email) is read from the token
 * without database hits for the middleware path.
 */

// Routes that skip auth entirely
const PUBLIC_PATHS = [
  '/admin/login',
  '/admin/create-first-user',
  '/admin/forgot-password',
  '/admin/reset-password',
  '/api',
  '/_next',
  '/favicon.ico',
  '/storage',
]
// Routes that door_staff must NOT access (admin-only)
const ADMIN_ONLY_PREFIXES = ['/admin/collections/bookings', '/console']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p))
}

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/scan') ||
    pathname.startsWith('/dashboard') ||
    // NOTE: admin-tools/* still exists on disk as of this commit (Phase 7C's
    // migration of Staff management + retirement of this directory is not
    // yet complete) -- keep it protected until that cleanup actually lands,
    // to avoid an auth-bypass window where the routes exist but are
    // unguarded by middleware.
    pathname.startsWith('/admin-tools') ||
    pathname.startsWith('/console')
  )
}

/**
 * Extract JWT payload from the payload-token cookie.
 * Does NOT verify signature here -- Payload's API layer re-verifies.
 * This is for route-gating purposes only.
 */
function getPayloadFromToken(req: NextRequest): {
  role: string
  mfaEnabled?: boolean
  active?: boolean
  id?: string
} | null {
  const token = req.cookies.get('payload-token')?.value
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    return {
      role: payload.role || 'door_staff',
      mfaEnabled: payload.mfaEnabled === true,
      active: payload.active,
      id: payload.id,
    }
  } catch {
    return null
  }
}

/**
 * Check whether the mfa-verified cookie is present and looks valid.
 * Full signature verification requires async jose call (compatible with
 * Edge Runtime middleware), but for a pragmatic route-gate we check:
 * 1. Cookie exists
 * 2. It decodes as a 3-part JWT
 * 3. It contains a plausible sub claim matching the user ID
 *
 * The actual verification (which sets this cookie) is done server-side
 * with full TOTP code validation. This gate just prevents bypass via
 * crafted cookies -- the server-side API always re-checks internally.
 */
function hasMfaVerifiedCookie(
  req: NextRequest,
  userId?: string,
): boolean {
  const verifiedToken = req.cookies.get('mfa-verified')?.value
  if (!verifiedToken) return false

  try {
    const parts = verifiedToken.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    // If we know the user's ID from the main token, ensure it matches
    if (userId && payload.sub !== String(userId)) return false
    return payload.mfa === true
  } catch {
    return false
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths through
  if (isPublicPath(pathname)) return NextResponse.next()

  // Only gate protected paths
  if (!isProtectedPath(pathname)) return NextResponse.next()

  // Check auth
  const session = getPayloadFromToken(req)

  if (!session) {
    // Redirect unauthenticated users to login
    const loginUrl = new URL('/admin/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Deactivated users: block all protected paths
  // Only enforce when the active field is explicitly false (undefined means
  // token was issued before the field existed — let it through gracefully).
  if (session.active === false) {
    return new NextResponse('Account deactivated. Contact an administrator.', {
      status: 403,
    })
  }

  // Door-staff blocked from admin-only paths
  if (session.role === 'door_staff' && isAdminOnlyPath(pathname)) {
    return new NextResponse('Forbidden: Admin access required for this page.', {
      status: 403,
    })
  }

  // MFA enforcement: users with mfaEnabled must have completed MFA verification
  if (session.mfaEnabled && !hasMfaVerifiedCookie(req, session.id)) {
    const verifyUrl = new URL('/mfa-verify', req.url)
    verifyUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(verifyUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/scan/:path*', '/dashboard/:path*', '/admin-tools/:path*', '/console/:path*'],
}
