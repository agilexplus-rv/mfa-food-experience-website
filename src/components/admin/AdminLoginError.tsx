'use client'

import { useEffect, useState } from 'react'

/**
 * Bug fix (2026-09-27): the only feedback on a failed /admin/login
 * submit was a Sonner toast (top-centre, 30 s duration -- see
 * payload.config.ts's admin.toast and AdminThemeStyles.tsx's
 * `[data-sonner-toaster]` styling), rendered in the same frame that
 * AdminSubmitOverlay's full-screen overlay disappears. Combined with
 * that overlay's load-time flash (see AdminSubmitOverlay.tsx), a wrong
 * password looked exactly like an instant page refresh with no visible
 * explanation. This component mirrors the error toast's message into a
 * persistent inline banner above the login form, styled to match the
 * toast (terracotta left border), so the failure is impossible to miss
 * and doesn't depend on the user noticing a transient toast.
 *
 * Rendered in Payload's `afterLogin` slot (LoginView-only, like
 * AdminPasswordReveal's `beforeLogin`), so it only ever mounts on
 * /admin/login. Uses direct DOM observation rather than a library, to
 * match this repo's existing admin component style (AdminPasswordReveal,
 * AdminBrandReparent) -- Payload's Form component has no override slot
 * for the auth-failure message itself.
 */
export default function AdminLoginError() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const seen = new WeakSet<Element>()

    const scan = () => {
      if (!document.querySelector('section.login')) return
      const toasts = document.querySelectorAll<HTMLElement>(
        '[data-sonner-toaster] [data-sonner-toast][data-type="error"]',
      )
      toasts.forEach((toast) => {
        if (seen.has(toast)) return
        seen.add(toast)
        const text = toast.textContent?.trim()
        setMessage(text || 'Login failed. Check your email and password.')
      })
    }

    scan()

    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })

    const clear = () => setMessage(null)
    const onInput = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest?.('.login__form')) clear()
    }
    const onSubmit = (e: Event) => {
      if ((e.target as HTMLElement | null)?.matches?.('.login__form')) clear()
    }
    document.addEventListener('input', onInput, true)
    document.addEventListener('submit', onSubmit, true)

    return () => {
      observer.disconnect()
      document.removeEventListener('input', onInput, true)
      document.removeEventListener('submit', onSubmit, true)
    }
  }, [])

  if (!message) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        background: '#FFFFFF',
        color: '#33483D',
        border: '1px solid rgba(51, 72, 61, 0.12)',
        borderLeftWidth: '4px',
        borderLeftColor: '#C9643D',
        borderRadius: '10px',
        padding: '14px 18px',
        marginBottom: '20px',
        fontFamily: "var(--font-sans, 'Montserrat', ui-sans-serif, system-ui, sans-serif)",
        fontSize: '0.9375rem',
        fontWeight: 500,
        lineHeight: 1.4,
        boxShadow: '0 8px 24px rgba(51, 72, 61, 0.16)',
      }}
    >
      {message}
    </div>
  )
}
