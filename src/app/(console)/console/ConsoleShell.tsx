/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

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
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Bookings', href: '/console/bookings', icon: 'BK' },
  { label: 'Events', href: '/console/events', icon: 'EV' },
  { label: 'Services', href: '/console/services', icon: 'SV' },
  { label: 'Content', href: '/console/content', icon: 'CN' },
  { label: 'Media', href: '/console/media', icon: 'MD' },
  { label: 'Coupons', href: '/console/coupons', icon: 'CP', badge: 'Phase C' },
  { label: 'Staff', href: '/console/staff', icon: 'ST', badge: 'Phase C' },
  { label: 'Audit Log', href: '/console/audit-log', icon: 'AL', badge: 'Phase C' },
  { label: 'Settings', href: '/console/settings', icon: 'SG', badge: 'Phase C' },
]

export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
      if (u.role === 'door_staff') {
        router.push('/scan')
        return
      }
      setUser(u)
    } catch {
      setError('Could not authenticate. Redirecting to login...')
      setTimeout(() => router.push('/admin/login'), 2000)
    }
  }, [router])

  useEffect(() => {
    void fetchUser()
  }, [fetchUser])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    try {
      await fetch('/api/users/logout', { method: 'POST' })
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

  if (!user) {
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
    <div className="flex min-h-screen bg-soft-beige">
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
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-lunar-green shadow-xl',
          'transition-transform duration-300 ease-in-out lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ boxSizing: 'border-box' }}
      >
        {/* Logo area */}
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-matte-gold text-sm font-black text-lunar-green">
            MF
          </div>
          <div>
            <div className="text-sm font-bold text-soft-beige">MFA Operator</div>
            <div className="text-[10px] text-soft-beige/60">Console</div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-matte-gold/20 text-matte-gold'
                    : 'text-soft-beige/70 hover:bg-white/10 hover:text-soft-beige',
                ].join(' ')}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold opacity-70">
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-matte-gold/30 px-1.5 py-0.5 text-[9px] font-bold text-matte-gold">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: Public site link */}
        <div className="border-t border-white/10 px-3 py-3">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg px-3 py-2 text-xs font-semibold text-soft-beige/50 hover:bg-white/10 hover:text-soft-beige/80 transition-colors"
          >
            View Public Site &rarr;
          </a>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col" style={{ boxSizing: 'border-box' }}>
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
            <button
              onClick={handleLogout}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-light hover:border-terracotta hover:text-[#9C4E2F] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lunar-green"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6" style={{ boxSizing: 'border-box' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
