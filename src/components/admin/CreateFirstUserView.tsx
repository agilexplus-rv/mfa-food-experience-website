'use client'

// Must be a client component because:
// 1. It renders an interactive form with its own submission handling
// 2. It calls the MFA enrollment API and generates the QR code in-browser
// 3. Payload renders overridden root views via RenderServerComponent, which
//    passes client components only the serializable clientProps (so the
//    server-only initPageResult is never needed or received here)

import { useState } from 'react'
import QRCode from 'qrcode'
import AdminLogo from './AdminLogo'
import { validatePasswordStrength } from '@/lib/rbac/password'

/**
 * Replaces Payload's built-in CreateFirstUserView (registered as
 * admin.components.views.createFirstUser in payload.config.ts -- the key
 * must match config.admin.routes.createFirstUser, see node_modules/
 * @payloadcms/next/dist/views/Root/getRouteData.js). Payload still wraps
 * it in MinimalTemplate, so .template-minimal__wrap (styled in
 * AdminThemeStyles.tsx) is the white card; this view fills it.
 *
 * Two steps on one page:
 *   A. Create the account via Payload's REST first-register endpoint,
 *      which also logs the new user in (Set-Cookie: payload-token).
 *   B. Enroll TOTP with that session (/api/mfa/enroll + verify-setup),
 *      so the first admin never lands on the dashboard without 2FA.
 */

type Step = 'account' | 'enrolling' | 'enroll-error' | 'scan' | 'verifying' | 'done'

// Payload REST errors look like { errors: [{ message, data?: { errors: [{ message }] } }] }
function extractPayloadError(body: unknown, fallback: string): string {
  const errors = (body as { errors?: unknown })?.errors
  if (!Array.isArray(errors) || errors.length === 0) return fallback
  const messages: string[] = []
  for (const err of errors as Array<{ message?: string; data?: { errors?: Array<{ message?: string }> } }>) {
    const fieldErrors = err?.data?.errors
    if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
      fieldErrors.forEach((f) => f?.message && messages.push(f.message))
    } else if (err?.message) {
      messages.push(err.message)
    }
  }
  return messages.length > 0 ? messages.join(' ') : fallback
}

export default function CreateFirstUserView() {
  const [step, setStep] = useState<Step>('account')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [manualKey, setManualKey] = useState<string | null>(null)
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [totpError, setTotpError] = useState<string | null>(null)

  const startEnrollment = async () => {
    setStep('enrolling')
    setTotpError(null)
    try {
      const res = await fetch('/api/mfa/enroll', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Enrollment failed')

      const qrUrl = await QRCode.toDataURL(data.qrUri, {
        width: 256,
        margin: 2,
        color: { dark: '#33483D', light: '#F9F4EF' },
      })
      setQrDataUrl(qrUrl)
      setManualKey(data.manualKey)
      setDigits(['', '', '', '', '', ''])
      setStep('scan')
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : 'Failed to start enrollment')
      setStep('enroll-error')
    }
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccountError(null)

    if (!email.trim()) {
      setAccountError('Please enter your email address.')
      return
    }
    // The Users beforeChange hook enforces the same policy, but its thrown
    // Error is masked as "Something went wrong." by Payload's routeError
    // outside debug mode -- check here so the user sees the real reason.
    const strength = validatePasswordStrength(password)
    if (!strength.valid) {
      setAccountError(strength.errors.join(' '))
      return
    }
    if (password !== confirmPassword) {
      setAccountError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/users/first-register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          'confirm-password': confirmPassword,
          // The role field defaults to door_staff, and only admins can
          // create users afterwards -- so the bootstrap account must be
          // an admin or nobody could ever administer the site. The
          // built-in view exposed this as a form field; it is implicit here.
          role: 'admin',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(extractPayloadError(data, 'Could not create the account. Please try again.'))
      }
      // first-register set the payload-token cookie; go straight to TOTP.
      // Called from the handler (not a useEffect) so React strict mode
      // can't double-enroll and leave the QR out of sync with the DB.
      await startEnrollment()
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Could not create the account.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDigitInput = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...digits]
    next[index] = value
    setDigits(next)
    if (value && index < 5) {
      document.getElementById(`cfu-digit-${index + 1}`)?.focus()
    }
  }

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      document.getElementById(`cfu-digit-${index - 1}`)?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      document.getElementById(`cfu-digit-${index - 1}`)?.focus()
    }
    if (e.key === 'ArrowRight' && index < 5) {
      document.getElementById(`cfu-digit-${index + 1}`)?.focus()
    }
  }

  const verifyCode = async (codeStr?: string) => {
    const code = codeStr || digits.join('')
    if (code.length !== 6) {
      setTotpError('Please enter all 6 digits.')
      return
    }
    setStep('verifying')
    setTotpError(null)
    try {
      const res = await fetch('/api/mfa/verify-setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Verification failed')

      setStep('done')
      // Same as mfa-setup/page.tsx: mfaEnabled is baked into the JWT
      // (saveToJWT), so re-sign it before navigating or middleware's
      // admin-without-MFA rule bounces /admin to /mfa-setup.
      try {
        await fetch('/api/users/refresh-token', { method: 'POST', credentials: 'include' })
      } catch {
        // Non-fatal: worst case middleware routes through /mfa-setup.
      }
      // Hard navigation so the request carries the fresh cookies.
      window.location.href = '/admin'
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : 'Verification failed')
      setStep('scan')
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '')
    if (pasted.length >= 6) {
      const next = pasted.slice(0, 6).split('')
      setDigits(next)
      verifyCode(next.join(''))
    }
  }

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    verifyCode()
  }

  return (
    <div className="notranslate cfu">
      <div className="cfu-brand">
        <AdminLogo />
      </div>

      {step === 'account' && (
        <>
          <h1 className="cfu-title">Create Your Account</h1>
          <p className="cfu-subtitle">Set up your administrator account to get started.</p>

          <form onSubmit={handleCreateAccount} className="cfu-form" noValidate>
            <div className="cfu-field">
              <label htmlFor="cfu-email" className="cfu-label">Email</label>
              <input
                id="cfu-email"
                type="email"
                className="cfu-input"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="cfu-field">
              <label htmlFor="cfu-password" className="cfu-label">Password</label>
              <input
                id="cfu-password"
                type="password"
                className="cfu-input"
                autoComplete="new-password"
                aria-describedby="cfu-password-hint"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p id="cfu-password-hint" className="cfu-hint">
                At least 12 characters, with upper- and lowercase letters, a number and a symbol.
              </p>
            </div>
            <div className="cfu-field">
              <label htmlFor="cfu-confirm-password" className="cfu-label">Confirm Password</label>
              <input
                id="cfu-confirm-password"
                type="password"
                className="cfu-input"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {accountError && (
              <p className="cfu-error" role="alert">{accountError}</p>
            )}

            <button type="submit" className="cfu-button" disabled={submitting}>
              {submitting ? 'Creating Account…' : 'Create Account'}
            </button>
          </form>
        </>
      )}

      {step === 'enrolling' && (
        <>
          <h1 className="cfu-title">Set Up Two-Factor Authentication</h1>
          <p className="cfu-subtitle">Generating your secure key…</p>
        </>
      )}

      {step === 'enroll-error' && (
        <>
          <h1 className="cfu-title">Setup Error</h1>
          <p className="cfu-subtitle">
            Your account was created, but two-factor setup could not start.
          </p>
          {totpError && <p className="cfu-error" role="alert">{totpError}</p>}
          <button type="button" className="cfu-button" onClick={startEnrollment}>
            Try Again
          </button>
        </>
      )}

      {(step === 'scan' || step === 'verifying') && (
        <>
          <h1 className="cfu-title">Set Up Two-Factor Authentication</h1>
          <p className="cfu-subtitle">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </p>

          {qrDataUrl && (
            <div className="cfu-qr">
              <img src={qrDataUrl} alt="QR code for your authenticator app" width={256} height={256} />
            </div>
          )}

          {manualKey && (
            <div className="cfu-manual">
              <p className="cfu-manual-label">Or enter this key manually:</p>
              <code className="cfu-manual-key">{manualKey}</code>
            </div>
          )}

          <form onSubmit={handleVerifySubmit} className="cfu-form">
            <label htmlFor="cfu-digit-0" className="cfu-label cfu-label--center">
              Enter the 6-digit code from your app:
            </label>
            <div className="cfu-digits" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  id={`cfu-digit-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitInput(i, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(i, e)}
                  className="cfu-digit-input"
                  autoComplete="one-time-code"
                  aria-label={`Digit ${i + 1}`}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {totpError && <p className="cfu-error" role="alert">{totpError}</p>}

            <button type="submit" className="cfu-button" disabled={step === 'verifying'}>
              {step === 'verifying' ? 'Verifying…' : 'Verify & Continue'}
            </button>
          </form>
        </>
      )}

      {step === 'done' && (
        <>
          <div className="cfu-success-icon" aria-hidden="true">&#10003;</div>
          <h1 className="cfu-title">You&rsquo;re All Set</h1>
          <p className="cfu-subtitle">Two-factor authentication is active. Opening the admin panel…</p>
        </>
      )}

      <style>{cfuStyles}</style>
    </div>
  )
}

// Deliberately NOT wrapped in @layer: Payload's admin CSS (and
// AdminThemeStyles) live in @layer payload-default, and unlayered rules
// always win over layered ones -- so Payload's global h1/p/input/label
// styles can't override the sizes below regardless of specificity.
const cfuStyles = `
  /* Payload's MinimalTemplate .template-minimal__wrap is already the white
     card (AdminThemeStyles.tsx); just widen it for this view. The section
     class is the route's viewKey (getRouteData.js templateClassName). */
  .createFirstUser .template-minimal__wrap {
    max-width: 440px;
  }
  .cfu {
    font-family: var(--font-sans, 'Montserrat', ui-sans-serif, system-ui, sans-serif);
    text-align: center;
  }
  .cfu-brand {
    display: flex;
    justify-content: center;
    margin-bottom: 32px;
  }
  .cfu-brand img {
    display: block;
  }
  .cfu-title {
    color: #33483D;
    font-family: inherit;
    font-weight: 700;
    font-size: 1.25rem;
    line-height: 1.3;
    letter-spacing: normal;
    margin: 0 0 8px;
  }
  .cfu-subtitle {
    color: #58685E;
    font-weight: 400;
    font-size: 0.875rem;
    line-height: 1.5;
    margin: 0 0 24px;
  }
  .cfu-form {
    text-align: left;
    margin: 0;
  }
  .cfu-field {
    margin-bottom: 16px;
  }
  .cfu-label {
    display: block;
    color: #33483D;
    font-weight: 600;
    font-size: 0.8125rem;
    margin: 0 0 4px;
  }
  .cfu-label--center {
    text-align: center;
    margin-bottom: 12px;
  }
  .cfu-input {
    display: block;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    padding: 10px 14px;
    font-family: inherit;
    font-size: 0.9375rem;
    color: #33483D;
    background: #FFFFFF;
    border: 1px solid #E5D8C4;
    border-radius: 8px;
    box-shadow: none;
    outline: none;
    transition: border-color 150ms ease;
  }
  .cfu-input:focus {
    border-color: #33483D;
  }
  .cfu-hint {
    color: #58685E;
    font-size: 0.75rem;
    line-height: 1.4;
    margin: 6px 0 0;
  }
  .cfu-error {
    color: #9C4E2F;
    font-size: 0.875rem;
    line-height: 1.5;
    text-align: center;
    margin: 0 0 16px;
  }
  .cfu-button {
    display: block;
    box-sizing: border-box;
    width: 100%;
    padding: 14px 24px;
    margin: 8px 0 0;
    background: #33483D;
    color: #F9F4EF;
    font-family: inherit;
    font-weight: 700;
    font-size: 1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 150ms ease;
  }
  .cfu-button:hover {
    background: color-mix(in srgb, #33483D 85%, transparent);
  }
  .cfu-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .cfu-button:disabled:hover {
    background: #33483D;
  }
  .cfu-qr {
    display: inline-block;
    background: #FFFFFF;
    border: 1px solid #E5D8C4;
    border-radius: 12px;
    padding: 12px;
    margin: 0 0 16px;
  }
  .cfu-qr img {
    display: block;
    width: 220px;
    max-width: 100%;
    height: auto;
  }
  .cfu-manual {
    margin: 0 0 24px;
  }
  .cfu-manual-label {
    color: #58685E;
    font-size: 0.8125rem;
    margin: 0 0 6px;
  }
  .cfu-manual-key {
    display: inline-block;
    background: #F4EDE3;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: ui-monospace, 'Courier New', monospace;
    font-size: 0.875rem;
    color: #58685E;
    word-break: break-all;
    letter-spacing: 0.05em;
  }
  .cfu-digits {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin: 0 0 20px;
  }
  .cfu-digit-input {
    box-sizing: border-box;
    width: 44px;
    height: 52px;
    padding: 0;
    text-align: center;
    font-family: inherit;
    font-size: 1.375rem;
    font-weight: 700;
    color: #33483D;
    background: #FFFFFF;
    border: 1px solid #E5D8C4;
    border-radius: 8px;
    outline: none;
    transition: border-color 150ms ease;
  }
  .cfu-digit-input:focus {
    border-color: #33483D;
  }
  @media (max-width: 380px) {
    .cfu-digits { gap: 6px; }
    .cfu-digit-input { width: 38px; height: 46px; }
  }
  .cfu-success-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #33483D;
    color: #F9F4EF;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    margin: 0 auto 24px;
  }
`
