/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'

interface UserInfo {
  id: string | number
  email: string
  role: string
}

interface NavItem {
  label: string
  href: string
  icon: string
  badge?: string
  /** Roles that see this item. Defaults to admin only. */
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Bookings', href: '/console/bookings', icon: 'BK' },
  { label: 'Waitlist', href: '/console/waitlist', icon: 'WL' },
  { label: 'Events', href: '/console/events', icon: 'EV' },
  { label: 'Services', href: '/console/services', icon: 'SV' },
  { label: 'Content', href: '/console/content', icon: 'CN' },
  { label: 'Media', href: '/console/media', icon: 'MD' },
  { label: 'Coupons', href: '/console/coupons', icon: 'CP' },
  { label: 'Staff', href: '/console/staff', icon: 'ST' },
  { label: 'Audit Log', href: '/console/audit-log', icon: 'AL' },
  { label: 'Settings', href: '/console/settings', icon: 'SG' },
  // Door staff reach the console only for Help, so give them a way back
  // to their own tools.
  { label: 'Check-in Dashboard', href: '/dashboard', icon: 'DB', roles: ['door_staff'] },
  { label: 'QR Scanner', href: '/scan', icon: 'QR', roles: ['door_staff'] },
  { label: 'Help', href: '/console/help', icon: 'HL', roles: ['admin', 'door_staff'] },
]

// Console pages door_staff may open (mirrors DOOR_STAFF_CONSOLE_PATHS in
// src/middleware.ts); every other console path sends them to /scan.
const DOOR_STAFF_PATHS = ['/console/help']

function doorStaffAllowed(pathname: string): boolean {
  return DOOR_STAFF_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Desktop-only rail mode; mobile slide-over always renders full width.
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me', {
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error('Failed to load user')
      }
      const data = await res.json()
      const u = data.user || data
      setUser(u)
    } catch {
      setError('Could not authenticate. Redirecting to login...')
      setTimeout(() => router.push('/admin/login'), 2000)
    }
  }, [router])

  useEffect(() => {
    void fetchUser()
  }, [fetchUser])

  const blockedDoorStaff = user?.role === 'door_staff' && !doorStaffAllowed(pathname)

  useEffect(() => {
    if (blockedDoorStaff) router.push('/scan')
  }, [blockedDoorStaff, router])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    // Write a 'logout' audit-log entry BEFORE the actual logout call,
    // while the session cookie is still valid (the audit-log endpoint
    // needs the cookie to resolve the actor user for the relationship).
    // Best-effort: if this fails, proceed with logout anyway.
    try {
      await fetch('/console/api/audit-log/logout', { method: 'POST' })
    } catch { /* best-effort: don't block logout */ }
    try {
      await fetch('/api/users/logout', { method: 'POST', headers: { 'X-Audit-Logged': '1' } })
    } catch { /* best-effort */ }
    router.push('/admin/login')
  }

  if (error && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-soft-beige">
        <div className="text-center">
          <p className="text-[#9C4E2F]">{error}</p>
        </div>
      </div>
    )
  }

  if (!user || blockedDoorStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-soft-beige">
        <div className="text-center text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Verifying...
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-soft-beige supports-[height:100dvh]:h-dvh">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col overflow-hidden bg-lunar-green shadow-xl',
          'transition-[transform,width] duration-300 ease-in-out lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-16' : 'lg:w-64',
        ].join(' ')}
        style={{ boxSizing: 'border-box' }}
      >
        {/* Logo area -- Malta Food Agency brand mark (inverted variant,
            matching the public site's header/footer usage on the same
            bg-lunar-green background), not a text-abbreviation placeholder. */}
        <div className={[
          'flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5',
          collapsed ? 'lg:justify-center lg:px-2' : '',
        ].join(' ')}>
          <Logo variant="inverted" size="sm" className="!p-0 h-9 w-auto" />
          <div className={collapsed ? 'lg:hidden' : ''}>
            <div className="whitespace-nowrap text-sm font-bold text-soft-beige">Operator Console</div>
          </div>
        </div>

        {/* Nav items */}
        <nav className={['flex-1 overflow-y-auto py-4', collapsed ? 'px-3 lg:px-2' : 'px-3'].join(' ')}>
          {NAV_ITEMS.filter((item) => (item.roles ?? ['admin']).includes(user.role)).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matte-gold',
                  collapsed ? 'lg:justify-center lg:px-0' : '',
                  isActive
                    ? 'bg-matte-gold/20 text-soft-beige'
                    : 'text-soft-beige/70 hover:bg-white/10 hover:text-soft-beige',
                ].join(' ')}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold opacity-70">
                  {item.icon}
                </span>
                <span className={['flex-1 whitespace-nowrap', collapsed ? 'lg:hidden' : ''].join(' ')}>{item.label}</span>
                {item.badge && (
                  <span className={[
                    'rounded-full bg-matte-gold/30 px-1.5 py-0.5 text-[9px] font-bold text-soft-beige',
                    collapsed ? 'lg:hidden' : '',
                  ].join(' ')}>
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: Public site link */}
        <div className={['shrink-0 border-t border-white/10 py-3', collapsed ? 'px-3 lg:px-2' : 'px-3'].join(' ')}>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? 'View Public Site' : undefined}
            aria-label="View Public Site"
            className={[
              'block whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold text-soft-beige/70 hover:bg-white/10 hover:text-soft-beige/80 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matte-gold',
              collapsed ? 'lg:px-0 lg:text-center' : '',
            ].join(' ')}
          >
            <span className={collapsed ? 'lg:hidden' : ''}>View Public Site </span>&rarr;
          </a>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden" style={{ boxSizing: 'border-box' }}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-soft-beige/95 px-4 backdrop-blur-sm lg:px-6"
          style={{ boxSizing: 'border-box' }}>
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-2 text-lunar-green hover:bg-surface transition-colors lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lunar-green"
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {sidebarOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* Desktop collapse toggle */}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="hidden rounded-lg p-2 text-lunar-green hover:bg-surface transition-colors lg:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lunar-green"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {collapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
                )}
              </svg>
            </button>

            {/* Breadcrumb */}
            <div className="hidden text-sm text-text-light sm:block">
              <span className="font-semibold text-lunar-green">Console</span>
              {pathname !== '/console' && (
                <span className="mx-1.5">/</span>
              )}
              <span className="capitalize">
                {pathname.split('/')[2] || ''}
              </span>
            </div>
          </div>

          {/* User info + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-sm font-semibold text-lunar-green">{user.email}</span>
              <span className={[
                'rounded-full px-2 py-0.5 text-xs font-semibold',
                user.role === 'admin'
                  ? 'bg-terracotta/20 text-[#9C4E2F]'
                  : 'bg-lunar-green/20 text-lunar-green',
              ].join(' ')}>
                {user.role === 'admin' ? 'Admin' : 'Door Staff'}
              </span>
            </div>
            <Link
              href={user.role === 'admin' ? '/console/account' : '/account'}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-light hover:border-lunar-green hover:text-lunar-green transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lunar-green"
            >
              Change password
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-light hover:border-terracotta hover:text-[#9C4E2F] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lunar-green"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ boxSizing: 'border-box' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
