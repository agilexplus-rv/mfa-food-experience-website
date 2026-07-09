'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

import {
  queueScan,
  getQueuedScans,
  removeQueuedScan,
  getQueueCount,
  bumpRetry,
  purgeStaleEntries,
  type PurgedScan,
} from '@/lib/check-in/offline-queue'

// No localStorage or sessionStorage anywhere in this page (ADR-008 C18).
// All state is React component state + IndexedDB (offline queue only).
// IndexedDB is acceptable per C18 — see src/lib/check-in/offline-queue.ts
// for the compliance rationale.

// --- Types ---

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
  checkInStaffName?: string
}

interface StaffEvent {
  id: string | number
  title: string
  date: string
  startTime: string
  capacity: number
  booked: number
  remaining: number
  checkedIn: number
}

interface CapacityInfo {
  eventId: string | number
  capacity: number
  booked: number
  remaining: number
  checkedIn: number
}

interface SearchResult {
  id: string | number
  reference: string
  eventTitle: string | null
  leadAttendeeName: string
  email: string
  persons: number
  status: string
  checkedInAt: string | null
  createdAt: string
}

interface UserInfo {
  id: string | number
  email: string
  role: string
}

// --- Helpers ---

function eventLabel(e: StaffEvent): string {
  const d = new Date(e.date)
  const dateStr = d.toLocaleDateString('en-MT', { day: 'numeric', month: 'short' })
  const t = e.startTime ? new Date(e.startTime).toLocaleTimeString('en-MT', { hour: '2-digit', minute: '2-digit' }) : ''
  return `${dateStr} ${t ? t + ' — ' : ''}${e.title}`
}

const MAX_SYNC_RETRIES = 3

// --- Component ---

export default function ScanPage() {
  // Core scan state (existing)
  const [manualToken, setManualToken] = useState('')
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerDivRef = useRef<HTMLDivElement>(null)

  // Scope 1: Offline queue
  const [queueLength, setQueueLength] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState('')
  const [purgedNotice, setPurgedNotice] = useState<PurgedScan[]>([])

  // Scope 2: Manual lookup
  const [lookupMode, setLookupMode] = useState<'token' | 'lookup'>('token')
  const [lookupQuery, setLookupQuery] = useState('')
  const [lookupResults, setLookupResults] = useState<SearchResult[] | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  // Scope 3: Live capacity + event selector
  const [events, setEvents] = useState<StaffEvent[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [capacity, setCapacity] = useState<CapacityInfo | null>(null)

  // --- Initialisation ---

  // Fetch user info on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/users/me')
        if (!res.ok) {
          if (res.status === 401) { window.location.href = '/admin/login'; return }
          return
        }
        const data = await res.json()
        if (!cancelled) setUser(data.user || data)
      } catch { /* ignore */ }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => undefined)
      }
    }
  }, [])

  // Load offline queue count on mount + after each submit
  const refreshQueueCount = useCallback(async () => {
    try {
      const c = await getQueueCount()
      setQueueLength(c)
    } catch { /* IndexedDB may not be available */ }
  }, [])

  useEffect(() => { void refreshQueueCount() }, [refreshQueueCount])

  // Load events for capacity selector
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/staff/events')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.events?.length) {
          setEvents(data.events)
          if (!selectedEventId) {
            setSelectedEventId(String(data.events[0].id))
          }
        }
      } catch { /* ignore */ }
    }
    void load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch capacity for selected event
  const refreshCapacity = useCallback(async (eventId: string) => {
    if (!eventId) return
    try {
      const res = await fetch(`/api/staff/events?event=${eventId}`)
      if (!res.ok) return
      const data = await res.json()
      setCapacity(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      void refreshCapacity(selectedEventId)
      const interval = setInterval(() => {
        void refreshCapacity(selectedEventId)
      }, 30_000)
      return () => clearInterval(interval)
    }
  }, [selectedEventId, refreshCapacity])

  // --- Offline queue sync ---

  const flushQueue = useCallback(async () => {
    setSyncing(true)
    try {
      // Auto-purge before syncing: drop anything past MAX_SYNC_RETRIES or
      // older than 24h so a long outage can't grow the queue unbounded.
      // Purged entries are surfaced to staff (never silently dropped) so
      // they know to check that attendee in manually instead.
      const purged = await purgeStaleEntries(MAX_SYNC_RETRIES)
      if (purged.length > 0) {
        setPurgedNotice((prev) => [...prev, ...purged])
      }

      const queued = await getQueuedScans()
      if (queued.length === 0) return

      for (let i = 0; i < queued.length; i++) {
        const item = queued[i]
        setSyncProgress(`Syncing ${i + 1} of ${queued.length} queued scans...`)
        try {
          const res = await fetch('/api/check-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: item.token }),
          })
          const data = await res.json()
          await removeQueuedScan(item.id)
          if (res.ok) {
            setResult({ ok: true, ...data })
          } else if (data.error === 'already_checked_in') {
            setResult({
              ok: false, reference: data.reference,
              error: 'already_checked_in',
              alreadyCheckedInAt: data.checkedInAt,
              leadAttendeeName: '', persons: 0, totalAmount: 0,
            })
          } else if (data.error === 'invalid_token') {
            setResult({
              ok: false, reference: '',
              error: 'invalid_token',
              leadAttendeeName: '', persons: 0, totalAmount: 0,
            })
          }
          // Small delay so user can see progress
          await new Promise((r) => setTimeout(r, 800))
        } catch {
          // Still offline or server error — bump retry, leave in queue.
          // If this push crosses MAX_SYNC_RETRIES, the *next* flush's
          // purgeStaleEntries call above will drop it and notify staff.
          await bumpRetry(item.id)
          // Don't clear progress, items stay queued
        }
        setResult(null)
      }
    } finally {
      setSyncing(false)
      setSyncProgress('')
      await refreshQueueCount()
    }
  }, [refreshQueueCount])

  // Auto-retry queue on connectivity restore + periodic retry
  useEffect(() => {
    const onOnline = () => { void flushQueue() }
    window.addEventListener('online', onOnline)

    // Also retry every 30s (in case we're online but the first flush was during a blip)
    const interval = setInterval(() => {
      void getQueueCount().then((c) => { if (c > 0) void flushQueue() })
    }, 30_000)

    return () => {
      window.removeEventListener('online', onOnline)
      clearInterval(interval)
    }
  }, [flushQueue])

  // Flush on mount (in case there were queued items from a previous session)
  useEffect(() => {
    void getQueueCount().then((c) => { if (c > 0) void flushQueue() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Core check-in logic ---

  const submitToken = useCallback(
    async (token: string) => {
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
          // Refresh capacity after successful check-in
          if (selectedEventId) void refreshCapacity(selectedEventId)
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
        // Network error — queue for offline sync (scope 1)
        try {
          const queued = await queueScan(trimmed)
          await refreshQueueCount()
          setResult({
            ok: false,
            reference: queued.id.slice(0, 8),
            error: 'queued',
            leadAttendeeName: '',
            persons: 0,
            totalAmount: 0,
          })
        } catch {
          // IndexedDB might not be available — fall back to hard error
          setResult({
            ok: false,
            reference: '',
            error: 'network_error',
            leadAttendeeName: '',
            persons: 0,
            totalAmount: 0,
          })
        }
      } finally {
        setSubmitting(false)
      }
    },
    [selectedEventId, refreshCapacity, refreshQueueCount],
  )

  // Check-in by booking ID (scope 2)
  const submitBookingId = useCallback(
    async (bookingId: string | number) => {
      setSubmitting(true)
      setResult(null)
      setLookupResults(null)
      try {
        const res = await fetch('/api/check-in/by-booking-id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId }),
        })
        const data = await res.json()
        if (res.ok) {
          setResult({ ok: true, ...data })
          if (selectedEventId) void refreshCapacity(selectedEventId)
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
    },
    [selectedEventId, refreshCapacity],
  )

  // --- Search for manual lookup (scope 2) ---

  const doLookup = useCallback(async () => {
    const q = lookupQuery.trim()
    if (!q) return
    setLookupLoading(true)
    setLookupError(null)
    setLookupResults(null)
    try {
      const params = new URLSearchParams({ q, limit: '5' })
      const res = await fetch(`/api/bookings/search?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Search failed')
      }
      const data = await res.json()
      setLookupResults(data.docs || [])
      if ((data.docs || []).length === 0) {
        setLookupError('No bookings found matching that query.')
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLookupLoading(false)
    }
  }, [lookupQuery])

  // --- Scanner control ---

  const startScanner = useCallback(async () => {
    setCameraError(null)
    setScanning(true)
    try {
      const scanner = new Html5Qrcode('qr-scanner-region')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          scanner.stop().catch(() => undefined)
          setScanning(false)
          void submitToken(decodedText)
        },
        () => {
          // qrCodeErrorCallback — ignore
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

  const clearResult = useCallback(() => {
    setResult(null)
    setLookupResults(null)
    setLookupError(null)
  }, [])

  // --- Result banners ---

  const resultBanner =
    !result ? null : result.error === 'queued' ? (
      // Scope 1: queued state — distinct from hard error
      <div className="rounded-xl border-2 border-matte-gold bg-matte-gold/5 p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">&#x1F4E5;</span>
          <h2 className="text-xl font-bold text-matte-gold">Queued</h2>
        </div>
        <p className="text-sm text-text mb-4">
          Scan saved. It will sync automatically when the connection is restored.
          You can keep scanning &mdash; all scans will be synced in order.
        </p>
        {queueLength > 0 && (
          <p className="text-xs text-text-light mb-4">
            {queueLength} scan{queueLength !== 1 ? 's' : ''} queued
          </p>
        )}
        <button
          onClick={clearResult}
          className="w-full rounded-lg bg-matte-gold px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition-colors"
        >
          Continue Scanning
        </button>
      </div>
    ) : result.ok ? (
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

          {/* Scope 5: staff accountability */}
          {result.checkInStaffName && (
            <>
              <dt className="text-text-light">Checked in by</dt>
              <dd className="font-semibold text-lunar-green">
                {result.checkInStaffName}
              </dd>
            </>
          )}
        </dl>
        <button
          onClick={clearResult}
          className="mt-4 w-full rounded-lg bg-lunar-green px-4 py-3 text-sm font-semibold text-white hover:bg-primary-light transition-colors"
        >
          Scan Another
        </button>
      </div>
    ) : (
      <div
        className={`rounded-xl border-2 p-6 ${
          result.error === 'already_checked_in'
            ? 'border-matte-gold bg-matte-gold/5'
            : 'border-terracotta bg-terracotta/5'
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">
            {result.error === 'already_checked_in' ? '\u26A0\uFE0F' : '\u274C'}
          </span>
          <h2
            className={`text-xl font-bold ${
              result.error === 'already_checked_in'
                ? 'text-matte-gold'
                : 'text-terracotta'
            }`}
          >
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
            ? `This booking (${result.reference}) was already checked in at ${result.alreadyCheckedInAt ? new Date(result.alreadyCheckedInAt).toLocaleTimeString('en-MT', { hour: '2-digit', minute: '2-digit' }) : 'an earlier time'}. No action needed.`
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
          className="mt-4 w-full rounded-lg bg-lunar-green px-4 py-3 text-sm font-semibold text-white hover:bg-primary-light transition-colors"
        >
          Try Again
        </button>
      </div>
    )

  // --- Render ---

  return (
    <div className="mx-auto max-w-md w-full px-4 py-8">
      {/* Header */}
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-black text-lunar-green tracking-tight">
          Door Check-In
        </h1>
        <p className="mt-1 text-sm text-text-light">
          Scan a QR code or enter the token manually
        </p>
        {user && (
          <p className="mt-1 text-xs text-text-light">
            Logged in as <span className="font-semibold">{user.email}</span>
            {user.role === 'door_staff' && (
              <span className="ml-1 rounded-full bg-matte-gold/20 px-1.5 py-0.5 text-[10px] font-semibold text-matte-gold">
                Door Staff
              </span>
            )}
          </p>
        )}
      </header>

      {/* Scope 3: Event selector + live capacity */}
      {events.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <label htmlFor="event-select" className="text-xs font-semibold text-text-light">
              Event
            </label>
            {capacity && (
              <span className="text-xs font-bold text-lunar-green">
                {capacity.checkedIn} / {capacity.capacity} checked in
              </span>
            )}
          </div>
          <select
            id="event-select"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm text-lunar-green bg-background focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
          >
            {events.map((e) => (
              <option key={String(e.id)} value={String(e.id)}>
                {eventLabel(e)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Scope 1: Purged-scan notice — surfaced, never silent */}
      {purgedNotice.length > 0 && (
        <div className="mb-4 rounded-lg border-2 border-terracotta bg-terracotta/5 p-3 text-xs text-terracotta">
          <p className="font-bold mb-1">
            {purgedNotice.length} scan{purgedNotice.length !== 1 ? 's' : ''} could not be synced
            {purgedNotice.length !== 1 ? ' and were' : ' and was'} removed from the queue
            ({purgedNotice.filter((p) => p.reason === 'max_retries').length} after {MAX_SYNC_RETRIES}{' '}
            failed attempts, {purgedNotice.filter((p) => p.reason === 'expired').length} expired after 24h).
          </p>
          <p className="mb-2">Please check these attendees in manually using the lookup tab.</p>
          <button
            onClick={() => setPurgedNotice([])}
            className="rounded-md border border-terracotta px-3 py-1 font-semibold hover:bg-terracotta hover:text-white transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Scope 1: Queue indicator */}
      {queueLength > 0 && !syncing && (
        <div className="mb-4 rounded-lg border border-matte-gold/50 bg-matte-gold/5 p-2 text-center text-xs font-semibold text-matte-gold">
          {queueLength} scan{queueLength !== 1 ? 's' : ''} queued — will sync when back online
        </div>
      )}

      {/* Scope 1: Sync progress */}
      {syncing && (
        <div className="mb-4 rounded-lg border border-matte-gold/50 bg-matte-gold/5 p-2 text-center text-xs font-semibold text-matte-gold flex items-center justify-center gap-2">
          <span className="inline-block w-3 h-3 border-2 border-matte-gold border-t-transparent rounded-full animate-spin" />
          {syncProgress || 'Syncing...'}
        </div>
      )}

      {/* Result banner (success or error) — blocks scanner while shown */}
      {resultBanner}

      {/* Scanner + manual entry — hidden when result is shown */}
      {!result && (
        <>
          {/* Mode toggle */}
          {!scanning && (
            <div className="flex gap-1 mb-4 rounded-lg bg-surface p-1 border border-border">
              <button
                onClick={() => { setLookupMode('token'); setLookupResults(null); setLookupError(null) }}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                  lookupMode === 'token'
                    ? 'bg-lunar-green text-white'
                    : 'text-text-light hover:text-lunar-green'
                }`}
              >
                QR / Token
              </button>
              <button
                onClick={() => setLookupMode('lookup')}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                  lookupMode === 'lookup'
                    ? 'bg-lunar-green text-white'
                    : 'text-text-light hover:text-lunar-green'
                }`}
              >
                Look Up Booking
              </button>
            </div>
          )}

          {lookupMode === 'token' ? (
            <>
              {/* QR scanner region */}
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
          ) : (
            /* Scope 2: Manual lookup fallback */
            <div className="rounded-xl border border-border bg-surface p-4">
              <label
                htmlFor="lookup-query"
                className="block text-sm font-semibold text-text-light mb-2"
              >
                Search by attendee name or booking reference
              </label>
              <div className="flex gap-2 mb-4">
                <input
                  id="lookup-query"
                  type="text"
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void doLookup() }}
                  placeholder="Name or reference..."
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm text-lunar-green placeholder:text-text-light/50 focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                  disabled={lookupLoading}
                />
                <button
                  onClick={() => void doLookup()}
                  disabled={lookupLoading || !lookupQuery.trim()}
                  className="rounded-lg bg-lunar-green px-4 py-3 text-sm font-bold text-white hover:bg-primary-light disabled:opacity-40 transition-colors"
                >
                  {lookupLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Search'
                  )}
                </button>
              </div>

              {lookupError && (
                <p className="text-sm text-text-light mb-3">{lookupError}</p>
              )}

              {lookupResults && lookupResults.length > 0 && (
                <div className="space-y-2">
                  {lookupResults.map((b) => (
                    <div
                      key={String(b.id)}
                      className="rounded-lg border border-border p-3 flex items-center justify-between gap-2 bg-background"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-lunar-green truncate">
                          {b.leadAttendeeName}
                        </p>
                        <p className="text-xs text-text-light">
                          {b.reference} &middot; {b.eventTitle || '\u2014'} &middot; {b.persons} person{b.persons !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs">
                          <span
                            className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              b.status === 'checked_in'
                                ? 'bg-lunar-green/20 text-lunar-green'
                                : b.status === 'confirmed'
                                  ? 'bg-lunar-green/20 text-lunar-green'
                                  : b.status === 'cancelled'
                                    ? 'bg-terracotta/20 text-terracotta'
                                    : 'bg-matte-gold/20 text-matte-gold'
                            }`}
                          >
                            {b.status.replace('_', ' ')}
                          </span>
                          {b.checkedInAt && (
                            <span className="ml-1 text-text-light">
                              at {new Date(b.checkedInAt).toLocaleTimeString('en-MT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </p>
                      </div>
                      {b.status !== 'checked_in' && b.status !== 'cancelled' && (
                        <button
                          onClick={() => void submitBookingId(b.id)}
                          disabled={submitting}
                          className="shrink-0 rounded-md bg-matte-gold px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40 transition-colors"
                        >
                          {submitting ? '...' : 'Check In'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Footer note */}
      <p className="mt-12 text-center text-xs text-text-light">
        Malta Food Experience &middot; Door Staff Tool
      </p>
    </div>
  )
}
