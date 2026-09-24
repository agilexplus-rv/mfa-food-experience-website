'use client'

import { useEffect, useState } from 'react'

/**
 * Banner shown in the Payload admin panel when the current user has
 * not yet enabled MFA. Appears as a prominent warning bar at the top
 * of every admin page, prompting the user to set up TOTP.
 *
 * Reads the user's mfaEnabled flag from the JWT stored in the
 * payload-token cookie (same pattern as the middleware's gate).
 */
export default function MfaSetupBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      const token = document.cookie
        .split('; ')
        .find((c) => c.startsWith('payload-token='))
        ?.split('=')[1]
      if (!token) return
      const parts = token.split('.')
      if (parts.length !== 3) return
      const payload = JSON.parse(atob(parts[1]))
      // Only show for admin users who haven't enabled MFA
      const role = payload.role
      const mfaEnabled = payload.mfaEnabled === true
      if (role === 'admin' && !mfaEnabled) {
        setShow(true)
      }
    } catch {
      // Silently ignore parse errors
    }
  }, [])

  if (!show) return null

  return (
    <>
      <div
        style={{
          background: '#C9643D',
          color: '#F9F4EF',
          fontFamily: "'Montserrat', ui-sans-serif, system-ui, sans-serif",
          padding: '12px 24px',
          textAlign: 'center',
          fontSize: '0.875rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span>
          Your account does not have two-factor authentication enabled.
        </span>
        <a
          href="/mfa-setup"
          style={{
            color: '#F9F4EF',
            background: 'rgba(255,255,255,0.15)',
            padding: '6px 16px',
            borderRadius: 6,
            textDecoration: 'none',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          Set Up MFA
        </a>
      </div>
    </>
  )
}
