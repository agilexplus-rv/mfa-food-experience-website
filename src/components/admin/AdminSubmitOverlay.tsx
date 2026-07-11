'use client'

import { useEffect, useState } from 'react'

/**
 * Snag #5 (2026-07-12): replace Payload's plain "Submitting..." toast
 * text (see @payloadcms/translations' `general.submitting` string,
 * shown via Sonner's toast.promise() loading state in
 * node_modules/@payloadcms/ui/dist/forms/Form/index.js) with a real
 * full-screen blocking overlay + circular spinner on /admin/forgot,
 * /admin/reset, and /admin/login specifically -- these are the forms
 * where an accidental double-submit or navigating away mid-request is
 * most consequential (password reset / login).
 *
 * There is no React-context override slot for this (Payload's Form
 * component doesn't expose a custom "processing" renderer prop), but
 * the <form> element it renders DOES carry a documented, purpose-built
 * attribute for exactly this: `data-form-ready` is `false` while
 * `processing` is true (see forms/Form/index.js's
 * `"data-form-ready": !processing && isMounted && !initializing`).
 * This component watches that attribute via MutationObserver (cheap,
 * no polling) and toggles a full-viewport overlay that:
 *   - shows a centred circular spinner + "Submitting..." label,
 *   - sets `pointer-events: none` + a transparent full-screen catcher
 *     so the user physically cannot interact with anything underneath
 *     (form fields, browser back-navigation link clicks inside the
 *     page, etc.) until the request resolves and data-form-ready
 *     flips back to "true",
 *   - does NOT block the browser's own back/refresh/close controls
 *     (that's outside what a page-level overlay can or should try to
 *     prevent -- only in-page interaction is blocked, matching what
 *     "does not let the user close before submission" can mean at the
 *     DOM level).
 */
export default function AdminSubmitOverlay() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const forms = () => Array.from(document.querySelectorAll<HTMLFormElement>('form.form'))

    const check = () => {
      const anyProcessing = forms().some((f) => f.getAttribute('data-form-ready') === 'false')
      setVisible(anyProcessing)
    }

    check()

    const observer = new MutationObserver(check)
    // Observe the whole body for attribute changes on any current or
    // future <form.form> element (Payload's forms are client-rendered
    // after hydration, so they may not exist at mount time yet).
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-form-ready'],
      subtree: true,
    })

    return () => observer.disconnect()
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Submitting, please wait"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        background: 'rgba(51, 72, 61, 0.35)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '4px solid rgba(249, 244, 239, 0.35)',
          borderTopColor: '#F9F4EF',
          animation: 'admin-submit-spin 0.8s linear infinite',
        }}
      />
      <span
        style={{
          color: '#F9F4EF',
          fontFamily: "var(--font-sans, 'Montserrat', ui-sans-serif, system-ui, sans-serif)",
          fontWeight: 600,
          fontSize: '0.9375rem',
          letterSpacing: '0.01em',
        }}
      >
        Submitting…
      </span>
      <style>{`
        @keyframes admin-submit-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
