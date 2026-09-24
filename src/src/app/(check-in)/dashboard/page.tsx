'use client'

import { useCallback, useEffect, useState } from 'react'

interface BookingRow {
  id: string | number
  reference: string
  eventTitle: string | null
  eventId: string | number | null
  eventDate: string | null
  leadAttendeeName: string
  email: string
  persons: number
  status: string
  totalAmount: number
  checkedInAt: string | null
  checkInStaffName: string | null
  noShow: boolean
  refundStatus: string | null
  createdAt: string
}

interface SearchResult {
  docs: BookingRow[]
  totalDocs: number
  page: number
  totalPages: number
}

interface UserInfo {
  id: string | number
  email: string
  role: string
}

interface CapacityInfo {
  eventId: string | number
  capacity: number
  booked: number
  remaining: number
  checkedIn: number
}

interface EventOption {
  id: string | number
  title: string
  date: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'checked_in', label: 'Checked In' },
]

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-matte-gold/20 text-matte-gold',
  confirmed: 'bg-lunar-green/20 text-lunar-green',
  cancelled: 'bg-terracotta/20 text-terracotta',
  checked_in: 'bg-lunar-green/20 text-lunar-green',
}

function formatCurrency(cents: number): string {
  return `\u20AC${(cents / 100).toFixed(2)}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString('en-MT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleString('en-MT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isEventPast(eventDate: string | null): boolean {
  if (!eventDate) return false
  const d = new Date(eventDate)
  d.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return d < now
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<EventOption[]>([])

  // Filters
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  // Action states
  const [cancellingId, setCancellingId] = useState<string | number | null>(null)
  const [resendingId, setResendingId] = useState<string | number | null>(null)
  const [noShowId, setNoShowId] = useState<string | number | null>(null)
  const [cancelResults, setCancelResults] = useState<Record<string, { refundId?: string; refundStatus?: string }>>({})
  const [exportEventId, setExportEventId] = useState('')

  // Capacity
  const [liveCapacity, setLiveCapacity] = useState<CapacityInfo | null>(null)

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me', {
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/admin/login'
          return
        }
        throw new Error('Failed to load user')
      }
      const data = await res.json()
      setUser(data.user || data)
    } catch {
      setError('Could not authenticate. Redirecting to login...')
      setTimeout(() => {
        window.location.href = '/admin/login'
      }, 2000)
    }
  }, [])

  const search = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(page))
      params.set('limit', '25')

      const res = await fetch(`/api/bookings/search?${params.toString()}`)
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/admin/login'
          return
        }
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Search failed')
      }
      const data = await res.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [q, statusFilter, page])

  // Load events for export dropdown
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/events')
      if (!res.ok) return
      const data = await res.json()
      if (data.events?.length > 0) {
        setEvents(data.events)
      }
    } catch { /* ignore */ }
  }, [])

  // Search on mount and when filters change
  useEffect(() => {
    void search()
  }, [search])

  // Fetch user info on mount
  useEffect(() => {
    void fetchUser()
  }, [fetchUser])

  // Fetch events
  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  // Live capacity poll
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/staff/events')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.events?.length > 0) {
          const firstEvent = data.events[0]
          try {
            const capRes = await fetch(`/api/staff/events?event=${firstEvent.id}`)
            if (capRes.ok) {
              const capData = await capRes.json()
              if (!cancelled) setLiveCapacity(capData)
            }
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }
    void load()
    const interval = setInterval(() => { void load() }, 30_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const handleCancel = useCallback(async (b: BookingRow) => {
    setCancellingId(b.id)
    try {
      const res = await fetch(`/api/bookings/${b.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by admin via dashboard' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Cancel failed')
      // Store refund info for display
      if (data.refund) {
        setCancelResults(prev => ({ ...prev, [String(b.id)]: data.refund }))
      }
      void search()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setCancellingId(null)
    }
  }, [search])

  const handleResendConfirmation = useCallback(async (id: string | number) => {
    setResendingId(id)
    try {
      const res = await fetch(`/api/bookings/${id}/resend-confirmation`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Resend failed')
      }
      alert('Confirmation email resent.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Resend failed')
    } finally {
      setResendingId(null)
    }
  }, [])

  const handleNoShow = useCallback(async (id: string | number) => {
    setNoShowId(id)
    try {
      const res = await fetch(`/api/bookings/${id}/no-show`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'No-show failed')
      }
      void search()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No-show failed')
    } finally {
      setNoShowId(null)
    }
  }, [search])

  const handleExportCSV = useCallback(() => {
    if (!exportEventId) return
    window.open(`/api/bookings/export?eventId=${exportEventId}`, '_blank')
  }, [exportEventId])

  function renderRefundStatus(b: BookingRow): string {
    const result = cancelResults[String(b.id)]
    if (result) return result.refundStatus || 'unknown'
    if (b.status === 'cancelled' && b.refundStatus && b.refundStatus !== 'none') return b.refundStatus
    return ''
  }

  if (error && !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-terracotta">{error}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl w-full px-4 py-8">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-lunar-green tracking-tight">
            Bookings Dashboard
          </h1>
          <p className="mt-1 text-sm text-text-light">
            Search and manage bookings
            {user?.role === 'door_staff' && (
              <span className="ml-2 rounded-full bg-matte-gold/20 px-2 py-0.5 text-xs font-semibold text-matte-gold">
                Door Staff
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* live capacity */}
          {liveCapacity && (
            <span className="text-sm font-semibold text-lunar-green">
              {liveCapacity.checkedIn} / {liveCapacity.capacity} checked in
            </span>
          )}
          {user?.role === 'admin' && (
            <>
              <a href="/console" className="rounded-lg border-2 border-lunar-green px-3 py-2 text-xs font-bold text-lunar-green hover:bg-lunar-green hover:text-white transition-colors">
                Console
              </a>
            </>
          )}
          <a
            href="/scan"
            className="rounded-lg border-2 border-lunar-green px-4 py-2 text-sm font-bold text-lunar-green hover:bg-lunar-green hover:text-white transition-colors"
          >
            &larr; Scanner
          </a>
        </div>
      </header>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-surface p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search input */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              placeholder="Search by reference, name, or email..."
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green placeholder:text-text-light/50 focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Search button */}
          <button
            onClick={() => { setPage(1); void search() }}
            disabled={loading}
            className="rounded-lg bg-lunar-green px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-light disabled:opacity-40 transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>

          {/* CSV Export (admin only) */}
          {user?.role === 'admin' && events.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={exportEventId}
                onChange={(e) => setExportEventId(e.target.value)}
                className="rounded-lg border border-border px-3 py-2.5 text-xs text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              >
                <option value="">Export CSV...</option>
                {events.map((ev) => (
                  <option key={String(ev.id)} value={String(ev.id)}>
                    {ev.title} ({formatDate(ev.date)})
                  </option>
                ))}
              </select>
              <button
                onClick={handleExportCSV}
                disabled={!exportEventId}
                className="rounded-lg border border-lunar-green px-3 py-2.5 text-xs font-bold text-lunar-green hover:bg-lunar-green hover:text-white disabled:opacity-30 transition-colors"
              >
                Export
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {loading && !results && (
        <div className="text-center py-16 text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading bookings...
        </div>
      )}

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-terracotta">
          {error}
        </div>
      )}

      {results && results.totalDocs === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center text-text-light">
          No bookings found.
        </div>
      )}

      {results && results.totalDocs > 0 && (
        <>
          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-soft-beige/50 text-left">
                  <th className="px-4 py-3 font-semibold text-text-light">Reference</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Event</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Attendee</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Persons</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Status</th>
                  {user?.role === 'admin' && (
                    <th className="px-4 py-3 font-semibold text-text-light text-right">Total</th>
                  )}
                  <th className="px-4 py-3 font-semibold text-text-light">Checked In</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Checked In By</th>
                  {user?.role === 'admin' && (
                    <th className="px-4 py-3 font-semibold text-text-light text-center">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {results.docs.map((b) => {
                  const refundText = renderRefundStatus(b)
                  const canNoShow = user?.role === 'admin'
                    && b.status === 'confirmed'
                    && isEventPast(b.eventDate)
                    && !b.checkedInAt
                    && !b.noShow

                  return (
                    <tr key={String(b.id)} className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-lunar-green">
                        {b.reference}
                      </td>
                      <td className="px-4 py-3 text-lunar-green">
                        {b.eventTitle || '\u2014'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-lunar-green">
                          {b.leadAttendeeName}
                          {b.noShow && (
                            <span className="ml-1.5 rounded-full bg-terracotta/20 px-1.5 py-0.5 text-[10px] font-bold text-terracotta">
                              NO-SHOW
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text-light">{b.email}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-lunar-green">
                        {b.persons}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {b.status.replace('_', ' ')}
                        </span>
                        {refundText && (
                          <span className={`ml-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            refundText === 'succeeded' ? 'bg-lunar-green/20 text-lunar-green' :
                            refundText === 'pending' ? 'bg-matte-gold/20 text-matte-gold' :
                            'bg-terracotta/20 text-terracotta'
                          }`}>
                            refund: {refundText}
                          </span>
                        )}
                      </td>
                      {user?.role === 'admin' && (
                        <td className="px-4 py-3 text-right font-semibold text-lunar-green">
                          {formatCurrency(b.totalAmount)}
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-text-light">
                        {formatDateTime(b.checkedInAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-light">
                        {b.checkInStaffName || '\u2014'}
                      </td>
                      {user?.role === 'admin' && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {b.status !== 'cancelled' && (
                              <button
                                onClick={() => handleCancel(b)}
                                disabled={cancellingId === b.id}
                                className="rounded-md border border-terracotta px-2 py-0.5 text-[10px] font-semibold text-terracotta hover:bg-terracotta hover:text-white disabled:opacity-40 transition-colors"
                              >
                                {cancellingId === b.id ? '...' : 'Cancel'}
                              </button>
                            )}
                            {b.status === 'confirmed' && (
                              <button
                                onClick={() => handleResendConfirmation(b.id)}
                                disabled={resendingId === b.id}
                                className="rounded-md border border-lunar-green px-2 py-0.5 text-[10px] font-semibold text-lunar-green hover:bg-lunar-green hover:text-white disabled:opacity-40 transition-colors"
                              >
                                {resendingId === b.id ? '...' : 'Resend'}
                              </button>
                            )}
                            {canNoShow && (
                              <button
                                onClick={() => handleNoShow(b.id)}
                                disabled={noShowId === b.id}
                                className="rounded-md border border-matte-gold px-2 py-0.5 text-[10px] font-semibold text-matte-gold hover:bg-matte-gold hover:text-white disabled:opacity-40 transition-colors"
                              >
                                {noShowId === b.id ? '...' : 'No-show'}
                              </button>
                            )}
                            {b.status === 'cancelled' && (
                              <span className="text-[10px] text-text-light">{'\u2014'}</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-sm text-text-light">
            <span>
              {results.totalDocs} booking{results.totalDocs !== 1 ? 's' : ''} found
              {results.totalPages > 1 && ` \u2014 page ${results.page} of ${results.totalPages}`}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={results.page <= 1}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-30 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={results.page >= results.totalPages}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-30 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
