'use client'

import { useState, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'

export default function MfaSetupPage() {
  const [step, setStep] = useState<'loading' | 'scan' | 'verifying' | 'done' | 'error'>('loading')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [manualKey, setManualKey] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const inputRefs = useCallback((node: HTMLInputElement | null) => {
    // handled via onKeyDown
  }, [])

  const startEnrollment = useCallback(async () => {
    try {
      const res = await fetch('/api/mfa/enroll', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Enrollment failed')
      }
      const data = await res.json()

      // Generate QR code data URL
      const qrUrl = await QRCode.toDataURL(data.qrUri, {
        width: 256,
        margin: 2,
        color: { dark: '#33483D', light: '#F9F4EF' },
      })
      setQrDataUrl(qrUrl)
      setManualKey(data.manualKey)
      setStep('scan')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start enrollment')
      setStep('error')
    }
  }, [])

  useEffect(() => {
    startEnrollment()
  }, [startEnrollment])

  const handleDigitInput = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...digits]
    next[index] = value
    setDigits(next)

    // Auto-focus next field
    if (value && index < 5) {
      const el = document.getElementById(`mfa-digit-${index + 1}`)
      el?.focus()
    }
  }

  const handleDigitKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const el = document.getElementById(`mfa-digit-${index - 1}`)
      el?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      const el = document.getElementById(`mfa-digit-${index - 1}`)
      el?.focus()
    }
    if (e.key === 'ArrowRight' && index < 5) {
      const el = document.getElementById(`mfa-digit-${index + 1}`)
      el?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '')
    if (pasted.length >= 6) {
      const newDigits = pasted.slice(0, 6).split('')
      setDigits(newDigits)
      // Auto-submit after paste
      const codeStr = newDigits.join('')
      if (codeStr.length === 6) {
        verifyCode(codeStr)
      }
    }
  }

  const verifyCode = async (codeStr?: string) => {
    const actualCode = codeStr || digits.join('')
    if (actualCode.length !== 6) {
      setError('Please enter all 6 digits.')
      return
    }
    setStep('verifying')
    setError(null)
    try {
      const res = await fetch('/api/mfa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: actualCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed')
      }
      setStep('done')
      // Refresh the Payload JWT BEFORE navigating: mfaEnabled is baked
      // into the JWT at login time (saveToJWT: true on the field), so
      // the cookie issued at login still says mfaEnabled=false even
      // though the DB now says true. Middleware reads the stale JWT
      // claim and its admin-without-MFA rule would redirect /admin
      // straight back to /mfa-setup forever -- the root cause of the
      // stuck "Redirecting to admin..." screen (Rudie, 2026-07-12).
      // /api/users/refresh-token is Payload's built-in auth endpoint;
      // it re-signs the JWT from CURRENT user state and Set-Cookies it.
      // Then use a hard navigation (not router.push) so the request
      // carries the fresh cookie through middleware with no client-
      // side router cache involved.
      try {
        await fetch('/api/users/refresh-token', { method: 'POST' })
      } catch {
        // Non-fatal: worst case middleware bounces back here and the
        // user retries; do not block the redirect attempt on this.
      }
      setTimeout(() => {
        window.location.href = '/admin'
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
      setStep('scan')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    verifyCode()
  }

  if (step === 'loading') {
    return (
      <div className="notranslate mfa-container">
        <div className="mfa-card">
          <h1 className="mfa-title">Set Up Two-Factor Authentication</h1>
          <p className="mfa-subtitle">Generating your secure key…</p>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="notranslate mfa-container">
        <div className="mfa-card">
          <h1 className="mfa-title">Setup Error</h1>
          <p style={{ color: '#C9643D', marginBottom: 16 }}>{error}</p>
          <button className="mfa-button" onClick={startEnrollment}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="notranslate mfa-container">
        <div className="mfa-card">
          <div
            className="mfa-success-icon"
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#33483D',
              color: '#F9F4EF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              margin: '0 auto 24px',
            }}
          >
            &#10003;
          </div>
          <h1 className="mfa-title">MFA Enabled</h1>
          <p className="mfa-subtitle">
            Two-factor authentication is now active. Redirecting to admin…
          </p>
        </div>
        <style>{mfaStyles}</style>
      </div>
    )
  }

  return (
    <div className="notranslate mfa-container">
      <div className="mfa-card">
        <h1 className="mfa-title">Set Up Two-Factor Authentication</h1>
        <p className="mfa-subtitle">
          Scan this QR code with your authenticator app (Google
          Authenticator, Authy, etc.)
        </p>

        {qrDataUrl && (
          <div className="mfa-qr">
            <img src={qrDataUrl} alt="TOTP QR Code" />
          </div>
        )}

        {manualKey && (
          <div className="mfa-manual">
            <p className="mfa-manual-label">
              Or enter this key manually:
            </p>
            <code className="mfa-manual-key">{manualKey}</code>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mfa-form">
          <label className="mfa-label">
            Enter the 6-digit code from your app:
          </label>
          <div className="mfa-digits" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                id={`mfa-digit-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitInput(i, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(i, e)}
                className="mfa-digit-input"
                autoComplete="one-time-code"
                autoFocus={i === 0}
              />
            ))}
          </div>

          {error && <p className="mfa-error">{error}</p>}

          <button
            type="submit"
            className="mfa-button"
            disabled={step === 'verifying'}
          >
            {step === 'verifying' ? 'Verifying…' : 'Verify & Enable MFA'}
          </button>
        </form>
      </div>
      <style>{mfaStyles}</style>
    </div>
  )
}

const mfaStyles = `
  .mfa-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #F9F4EF;
    font-family: 'Montserrat', ui-sans-serif, system-ui, sans-serif;
    padding: 24px;
    box-sizing: border-box;
  }
  .mfa-card {
    background: #FFFFFF;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(51,72,61,0.08);
    padding: 48px 40px;
    max-width: 440px;
    width: 100%;
    box-sizing: border-box;
    text-align: center;
  }
  @media (max-width: 480px) {
    .mfa-card { padding: 40px 24px; }
  }
  .mfa-title {
    color: #33483D;
    font-size: 1.375rem;
    font-weight: 700;
    margin: 0 0 8px;
  }
  .mfa-subtitle {
    color: #5A7A63;
    font-size: 0.9375rem;
    margin: 0 0 24px;
    line-height: 1.5;
  }
  .mfa-qr {
    background: #F9F4EF;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    display: inline-block;
  }
  .mfa-qr img {
    display: block;
    max-width: 200px;
    height: auto;
  }
  .mfa-manual {
    margin-bottom: 24px;
  }
  .mfa-manual-label {
    color: #5A7A63;
    font-size: 0.8125rem;
    margin: 0 0 6px;
  }
  .mfa-manual-key {
    background: #F4EDE3;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    color: #33483D;
    word-break: break-all;
    letter-spacing: 0.05em;
  }
  .mfa-form {
    text-align: left;
  }
  .mfa-label {
    color: #33483D;
    font-size: 0.875rem;
    font-weight: 600;
    display: block;
    margin-bottom: 12px;
    text-align: center;
  }
  .mfa-digits {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-bottom: 20px;
  }
  .mfa-digit-input {
    width: 48px;
    height: 56px;
    text-align: center;
    font-size: 1.5rem;
    font-weight: 700;
    font-family: 'Montserrat', ui-sans-serif, system-ui, sans-serif;
    border: 2px solid #E5D8C4;
    border-radius: 8px;
    color: #33483D;
    background: #FFFFFF;
    outline: none;
    transition: border-color 150ms ease;
    box-sizing: border-box;
  }
  .mfa-digit-input:focus {
    border-color: #33483D;
  }
  .mfa-error {
    color: #C9643D;
    font-size: 0.875rem;
    text-align: center;
    margin: 0 0 16px;
  }
  .mfa-button {
    width: 100%;
    padding: 14px 24px;
    background: #33483D;
    color: #F9F4EF;
    font-weight: 700;
    font-size: 1rem;
    font-family: 'Montserrat', ui-sans-serif, system-ui, sans-serif;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 150ms ease;
  }
  .mfa-button:hover { background: color-mix(in srgb, #33483D 85%, transparent); }
  .mfa-button:disabled { opacity: 0.7; cursor: not-allowed; }
`
