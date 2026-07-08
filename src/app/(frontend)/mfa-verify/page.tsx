'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function MfaVerifyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/admin'
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleDigitInput = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...digits]
    next[index] = value
    setDigits(next)
    if (value && index < 5) {
      const el = document.getElementById(`mfa-vdigit-${index + 1}`)
      el?.focus()
    }
  }

  const handleDigitKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const el = document.getElementById(`mfa-vdigit-${index - 1}`)
      el?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      const el = document.getElementById(`mfa-vdigit-${index - 1}`)
      el?.focus()
    }
    if (e.key === 'ArrowRight' && index < 5) {
      const el = document.getElementById(`mfa-vdigit-${index + 1}`)
      el?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '')
    if (pasted.length >= 6) {
      const newDigits = pasted.slice(0, 6).split('')
      setDigits(newDigits)
      if (newDigits.join('').length === 6) {
        submit(newDigits.join(''))
      }
    }
  }

  const submit = async (codeStr?: string) => {
    const actualCode = codeStr || digits.join('')
    if (actualCode.length !== 6) {
      setError('Please enter all 6 digits.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/mfa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: actualCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed')
      }
      router.push(data.redirect || redirectTo)
    } catch (err) {
      setDigits(['', '', '', '', '', ''])
      document.getElementById('mfa-vdigit-0')?.focus()
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit()
  }

  return (
    <div className="mfa-container">
      <div className="mfa-card">
        <div className="mfa-icon-wrap">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#33483D"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 className="mfa-title">Two-Factor Authentication</h1>
        <p className="mfa-subtitle">
          Enter the 6-digit code from your authenticator app to continue.
        </p>

        <form onSubmit={handleSubmit} className="mfa-form">
          <div className="mfa-digits" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                id={`mfa-vdigit-${i}`}
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
            disabled={submitting}
          >
            {submitting ? 'Verifying…' : 'Verify Code'}
          </button>
        </form>
      </div>
      <style>{mfaStyles}</style>
    </div>
  )
}

export default function MfaVerifyPage() {
  return (
    <Suspense fallback={
      <div className="mfa-container">
        <div className="mfa-card">
          <div className="mfa-icon-wrap">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#33483D"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="mfa-title">Two-Factor Authentication</h1>
          <p className="mfa-subtitle">Loading…</p>
        </div>
        <style>{mfaStyles}</style>
      </div>
    }>
      <MfaVerifyForm />
    </Suspense>
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
  .mfa-icon-wrap {
    margin-bottom: 20px;
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
  .mfa-form { text-align: left; }
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
