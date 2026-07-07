import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js middleware for route gating per ADR-007, ADR-008 C6.
 *
 * Protects /admin and /check-in routes:
 *   - Unauthenticated → redirect to /admin/login
 *   - Door-staff on /admin/bookings → blocked (403)
 *   - Door-staff on /admin/* → allowed (they can use check-in features)
 *
 * Uses Payload's HTTP-only cookie (`payload-token`) for session detection.
 * JWT payload (role, collection, email) is read from the token without
 * database hits for the middleware path.
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
const ADMIN_ONLY_PREFIXES = ['/admin/collections/bookings']

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
    pathname.startsWith('/dashboard')
  )
}

// Minimal JWT payload extraction from Payload's cookie token.
// This mirrors what Payload does internally — we don't re-verify
// the signature here (Payload's API layer does that), we only
// extract the role for route-gating purposes.
function getPayloadFromToken(req: NextRequest): { role: string } | null {
  const token = req.cookies.get('payload-token')?.value
  if (!token) return null
  try {
    // Payload JWT is a 3-part token; we only need the payload (second part)
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    return { role: payload.role || 'door_staff' }
  } catch {
    return null
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

  // Door-staff blocked from admin-only paths
  if (session.role === 'door_staff' && isAdminOnlyPath(pathname)) {
    return new NextResponse('Forbidden: Admin access required for this page.', {
      status: 403,
    })
  }

  return NextResponse.next()
}

export const config = {
  // Match all routes the middleware should run on.
  // NOTE: the door-staff tools (scan page, bookings dashboard) live
  // in the (check-in) route group at /scan and /dashboard -- route
  // groups in parens are not part of the URL path, so the matcher
  // targets those concrete paths directly.
  matcher: ['/admin/:path*', '/scan/:path*', '/dashboard/:path*'],
}
