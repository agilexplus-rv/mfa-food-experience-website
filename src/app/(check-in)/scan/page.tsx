'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

// No localStorage or sessionStorage anywhere in this page (ADR-008 C18).
// All state is React component state, cleared after each result.

interface CheckInResult {
  ok: boolean
  reference: string
  eventTitle?: string
  leadAttendeeName: string
  persons: number
  totalAmount: number
  checkedInAt?: string
  error?: string
  alreadyCheckedInAt?: string
}

export default function ScanPage() {
  const [manualToken, setManualToken] = useState('')
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerDivRef = useRef<HTMLDivElement>(null)

  // Clean up scanner on unmount.
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => undefined)
      }
    }
  }, [])

  const submitToken = useCallback(async (token: string) => {
    const trimmed = token.trim()
    if (!trimmed) return
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: trimmed }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, ...data })
      } else if (data.error === 'already_checked_in') {
        setResult({
          ok: false,
          reference: data.reference,
          error: 'already_checked_in',
          alreadyCheckedInAt: data.checkedInAt,
          leadAttendeeName: '',
          persons: 0,
          totalAmount: 0,
        })
      } else if (data.error === 'unauthenticated') {
        // Session expired — redirect to login.
        window.location.href = '/admin/login'
      } else {
        setResult({
          ok: false,
          reference: '',
          error: data.error || 'unknown_error',
          leadAttendeeName: '',
          persons: 0,
          totalAmount: 0,
        })
      }
    } catch {
      setResult({
        ok: false,
        reference: '',
        error: 'network_error',
        leadAttendeeName: '',
        persons: 0,
        totalAmount: 0,
      })
    } finally {
      setSubmitting(false)
    }
  }, [])

  const startScanner = useCallback(async () => {
    setCameraError(null)
    setScanning(true)
    try {
      // Create a new scanner instance targeting our div.
      const scanner = new Html5Qrcode('qr-scanner-region')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          // On scan, immediately stop the scanner and submit.
          scanner.stop().catch(() => undefined)
          setScanning(false)
          void submitToken(decodedText)
        },
        () => {
          // qrCodeErrorCallback — ignore (scanning noise is normal).
        },
      )
    } catch (err: unknown) {
      setScanning(false)
      const msg =
        err instanceof Error ? err.message : 'Could not access camera.'
      if (msg.includes('NotAllowed') || msg.includes('Permission')) {
        setCameraError(
          'Camera access was denied. Please allow camera permission or paste the token manually.',
        )
      } else if (msg.includes('NotFound') || msg.includes('No available')) {
        setCameraError(
          'No camera found. Please use the manual token input below instead.',
        )
      } else {
        setCameraError(msg)
      }
    }
  }, [submitToken])

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => undefined)
      scannerRef.current = null
    }
    setScanning(false)
  }, [])

  const manualSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      void submitToken(manualToken)
      setManualToken('')
    },
    [manualToken, submitToken],
  )

  const clearResult = useCallback(() => setResult(null), [])

  // Share the result area (success or error).
  const resultBanner =
    !result ? null : result.ok ? (
      <div className="rounded-xl border-2 border-lunar-green bg-lunar-green/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">&#x2705;</span>
          <h2 className="text-xl font-bold text-lunar-green">Checked In</h2>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-text-light">Reference</dt>
          <dd className="font-semibold text-lunar-green">{result.reference}</dd>

          <dt className="text-text-light">Event</dt>
          <dd className="font-semibold text-lunar-green">
            {result.eventTitle || '\u2014'}
          </dd>

          <dt className="text-text-light">Attendee</dt>
          <dd className="font-semibold text-lunar-green">
            {result.leadAttendeeName}
          </dd>

          <dt className="text-text-light">Persons</dt>
          <dd className="font-semibold text-lunar-green">{result.persons}</dd>

          <dt className="text-text-light">Checked in at</dt>
          <dd className="font-semibold text-lunar-green">
            {result.checkedInAt
              ? new Date(result.checkedInAt).toLocaleTimeString('en-MT', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '\u2014'}
          </dd>
        </dl>
        <button
          onClick={clearResult}
          className="mt-4 w-full rounded-lg bg-lunar-green px-4 py-3 text-sm font-semibold text-white hover:bg-primary-light transition-colors"
        >
          Scan Another
        </button>
      </div>
    ) : (
      <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">&#x274C;</span>
          <h2 className="text-xl font-bold text-terracotta">
            {result.error === 'already_checked_in'
              ? 'Already Checked In'
              : result.error === 'invalid_token'
                ? 'Invalid Token'
                : result.error === 'rate_limited'
                  ? 'Rate Limited'
                  : result.error === 'network_error'
                    ? 'Network Error'
                    : 'Error'}
          </h2>
        </div>
        <p className="text-sm text-text">
          {result.error === 'already_checked_in'
            ? `This booking (${result.reference}) was already checked in at ${result.alreadyCheckedInAt ? new Date(result.alreadyCheckedInAt).toLocaleTimeString('en-MT', { hour: '2-digit', minute: '2-digit' }) : 'an earlier time'}.`
            : result.error === 'invalid_token'
              ? 'This token does not match any booking. Check the code and try again.'
              : result.error === 'rate_limited'
                ? 'Too many attempts. Please wait a moment and try again.'
              : result.error === 'network_error'
                ? 'Could not connect to the server. Check your connection and try again.'
                : 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={clearResult}
          className="mt-4 w-full rounded-lg bg-terracotta px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition-colors"
        >
          Try Again
        </button>
      </div>
    )

  return (
    <div className="mx-auto max-w-md w-full px-4 py-8">
      {/* Header */}
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-black text-lunar-green tracking-tight">
          Door Check-In
        </h1>
        <p className="mt-2 text-sm text-text-light">
          Scan a QR code or enter the token manually
        </p>
      </header>

      {/* Result banner (success or error) — blocks scanner while shown */}
      {resultBanner}

      {/* QR scanner region — hidden when result is shown */}
      {!result && (
        <>
          <div
            id="qr-scanner-region"
            ref={scannerDivRef}
            className="overflow-hidden rounded-xl border-2 border-dashed border-border bg-surface"
            style={{ minHeight: 300 }}
          />

          {!scanning && !cameraError && (
            <button
              onClick={startScanner}
              className="mt-4 w-full rounded-xl bg-lunar-green px-4 py-4 text-base font-bold text-white hover:bg-primary-light transition-colors"
            >
              Start QR Scanner
            </button>
          )}

          {scanning && (
            <button
              onClick={stopScanner}
              className="mt-4 w-full rounded-xl border-2 border-terracotta px-4 py-3 text-sm font-semibold text-terracotta hover:bg-terracotta/10 transition-colors"
            >
              Stop Scanner
            </button>
          )}

          {cameraError && (
            <div className="mt-3 rounded-lg bg-matte-gold/10 border border-matte-gold/30 p-3 text-sm text-lunar-green">
              {cameraError}
            </div>
          )}

          {/* Manual token input fallback */}
          <form onSubmit={manualSubmit} className="mt-6">
            <label
              htmlFor="manual-token"
              className="block text-sm font-semibold text-text-light mb-2"
            >
              Or paste the token manually
            </label>
            <div className="flex gap-2">
              <input
                id="manual-token"
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste QR token here"
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-lunar-green placeholder:text-text-light/50 focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                disabled={submitting}
              />
              <button
                type="submit"
                disabled={submitting || !manualToken.trim()}
                className="rounded-lg bg-matte-gold px-4 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40 transition-colors"
              >
                {submitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Check In'
                )}
              </button>
            </div>
          </form>
        </>
      )}

      {/* Footer note */}
      <p className="mt-12 text-center text-xs text-text-light">
        Malta Food Experience &middot; Door Staff Tool
      </p>
    </div>
  )
}
