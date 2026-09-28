import { jwtVerify } from 'jose'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js middleware for route gating per ADR-007, ADR-008 C6.
 *
 * Protects /admin and /check-in routes:
 *   - Unauthenticated -> redirect to /admin/login
 *   - Door-staff on /admin/bookings -> blocked (403)
 *   - Door-staff on /admin/* -> allowed (they can use check-in features)
 *   - Door-staff on /console/* -> blocked, except /console/help
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
  // Payload's actual default admin routes are /admin/forgot and
  // /admin/reset (see node_modules/payload/dist/config/defaults.js
  // routes.forgot / routes.reset) -- NOT /admin/forgot-password /
  // /admin/reset-password. The wrong paths here meant middleware
  // treated the real forgot-password page as a PROTECTED route: an
  // unauthenticated visitor hit /admin/forgot, had no session, and
  // was redirected straight back to /admin/login?redirect=%2Fadmin%2Fforgot
  // -- an infinite bounce with the forgot-password page never
  // rendering. Confirmed 2026-07-11 (Rudie: "nothing happens" at
  // /admin/login?redirect=%2Fadmin%2Fforgot).
  '/admin/forgot',
  '/admin/reset',
  '/api',
  '/_next',
  '/favicon.ico',
  '/storage',
]
// Routes that door_staff must NOT access (admin-only)
const ADMIN_ONLY_PREFIXES = ['/admin/collections/bookings', '/console']
// Console pages door_staff may still open (staff help is shared by both roles)
const DOOR_STAFF_CONSOLE_PATHS = ['/console/help']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

function isAdminOnlyPath(pathname: string): boolean {
  if (DOOR_STAFF_CONSOLE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return false
  return ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p))
}

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/scan') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/account') ||
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
 * Verify the mfa-verified JWT cookie using jose (Edge-compatible).
 * Returns true only if the cookie has a valid signature and payload.
 */
async function hasMfaVerifiedCookie(
  req: NextRequest,
  userId?: string,
): Promise<boolean> {
  const verifiedToken = req.cookies.get('mfa-verified')?.value
  if (!verifiedToken) return false
  // Fail closed: jose accepts an empty HS256 key, so an unset secret would
  // let anyone forge the cookie.
  const envSecret = process.env.PAYLOAD_SECRET
  if (!envSecret) return false

  try {
    const secret = new TextEncoder().encode(envSecret)
    const { payload } = await jwtVerify(verifiedToken, secret)
    if (userId && payload.sub !== String(userId)) return false
    return payload.mfa === true
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Admin server actions (POST + Next-Action header) run as the cookie's
  // user even when posted to a public admin path like /admin/login, so
  // require MFA for them before the public-path early return. Requests
  // without a session (login, create-first-user) are never blocked.
  if (req.method === 'POST' && req.headers.has('next-action') && pathname.startsWith('/admin')) {
    const s = getPayloadFromToken(req)
    if (s?.mfaEnabled && !(await hasMfaVerifiedCookie(req, s.id))) {
      return new NextResponse('MFA verification required.', { status: 403 })
    }
  }

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
  if (session.mfaEnabled && !(await hasMfaVerifiedCookie(req, session.id))) {
    const verifyUrl = new URL('/mfa-verify', req.url)
    verifyUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(verifyUrl)
  }

  // MFA setup discoverability (Item 1): admin users who haven't enabled MFA
  // are redirected to /mfa-setup immediately. The only admin paths exempt
  // from this gate are /admin/login and /admin/logout (so they can get a
  // fresh JWT after enrolling).
  if (
    session.role === 'admin' &&
    !session.mfaEnabled &&
    pathname !== '/admin/login' &&
    !pathname.startsWith('/admin/logout')
  ) {
    const setupUrl = new URL('/mfa-setup', req.url)
    return NextResponse.redirect(setupUrl)
  }

  // Post-login landing: Payload's login form sends users to the admin root
  // (/admin) unless a ?redirect= is given. Staff work in the operator
  // console / door dashboard, so route them there by role. Deep links into
  // /admin/collections/... etc. are left alone.
  if (pathname === '/admin' || pathname === '/admin/') {
    const home = session.role === 'admin' ? '/console' : '/dashboard'
    return NextResponse.redirect(new URL(home, req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/scan/:path*', '/dashboard/:path*', '/account/:path*', '/console/:path*'],
}
