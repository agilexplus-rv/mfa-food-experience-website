'use client'

import { useCallback, useEffect, useState } from 'react'

interface BookingRow {
  id: string | number
  reference: string
  eventTitle: string | null
  leadAttendeeName: string
  email: string
  persons: number
  status: string
  totalAmount: number
  checkedInAt: string | null
  createdAt: string
}

interface SearchResult {
  docs: BookingRow[]
  totalDocs: number
  page: number
  totalPages: number
}

interface UserInfo {
  role: string
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
  return `\u20AC${cents.toFixed(2)}`
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

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  // Cancel state
  const [cancellingId, setCancellingId] = useState<string | number | null>(null)

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

  // Search on mount and when filters change.
  useEffect(() => {
    void search()
  }, [search])

  // Fetch user info on mount.
  useEffect(() => {
    void fetchUser()
  }, [fetchUser])

  const handleCancel = useCallback(async (id: string | number) => {
    setCancellingId(id)
    try {
      const res = await fetch(`/api/bookings/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by admin via dashboard' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Cancel failed')
      }
      // Refresh the results.
      void search()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setCancellingId(null)
    }
  }, [search])

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
        <a
          href="/scan"
          className="rounded-lg border-2 border-lunar-green px-4 py-2 text-sm font-bold text-lunar-green hover:bg-lunar-green hover:text-white transition-colors"
        >
          &larr; Scanner
        </a>
      </header>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-surface p-4 mb-6">
        <div className="flex flex-wrap gap-3">
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

          {/* Search button for explicit submit */}
          <button
            onClick={() => { setPage(1); void search() }}
            disabled={loading}
            className="rounded-lg bg-lunar-green px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-light disabled:opacity-40 transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
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
                  <th className="px-4 py-3 font-semibold text-text-light text-right">Total</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Checked In</th>
                  {user?.role === 'admin' && (
                    <th className="px-4 py-3 font-semibold text-text-light text-center">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {results.docs.map((b) => (
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
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-lunar-green">
                      {formatCurrency(b.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-light">
                      {formatDateTime(b.checkedInAt)}
                    </td>
                    {user?.role === 'admin' && (
                      <td className="px-4 py-3 text-center">
                        {b.status !== 'cancelled' ? (
                          <button
                            onClick={() => handleCancel(b.id)}
                            disabled={cancellingId === b.id}
                            className="rounded-md border border-terracotta px-2.5 py-1 text-xs font-semibold text-terracotta hover:bg-terracotta hover:text-white disabled:opacity-40 transition-colors"
                          >
                            {cancellingId === b.id ? '...' : 'Cancel'}
                          </button>
                        ) : (
                          <span className="text-xs text-text-light">\u2014</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
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
