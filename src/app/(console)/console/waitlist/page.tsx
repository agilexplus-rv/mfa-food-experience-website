/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Badge from '@/components/console/Badge'
import Card from '@/components/console/Card'
import { Pagination } from '@/components/console/DataTable'

interface WaitlistEntry {
  id: string | number
  eventId: string | number | null
  eventTitle: string | null
  email: string
  name: string
  phone: string | null
  persons: number
  status: string
  notifiedAt: string | null
  createdAt: string
}

interface SearchResult {
  docs: WaitlistEntry[]
  totalDocs: number
  page: number
  totalPages: number
}

interface EventOption {
  id: string | number
  title: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'notified', label: 'Notified' },
  { value: 'expired', label: 'Expired' },
]

export default function WaitlistPage() {
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<EventOption[]>([])
  const [eventFilter, setEventFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const fetchWaitlist = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (eventFilter) params.set('event', eventFilter)
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(page))
      params.set('limit', '25')
      const res = await fetch('/console/api/waitlist?' + params.toString())
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to load waitlist')
      }
      const data = await res.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [eventFilter, statusFilter, page])

  useEffect(() => { fetchWaitlist() }, [fetchWaitlist])

  useEffect(() => {
    // Fetch events for filter dropdown
    fetch('/console/api/events?limit=200')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.docs) setEvents(d.docs) })
      .catch(() => { /* ignore */ })
  }, [])

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black text-lunar-green tracking-tight">Waitlist</h1>
        <p className="mt-1 text-sm text-text-light">Manage waitlist entries across all events</p>
      </header>

      {/* Filters */}
      <Card className="mb-6" padding>
        <div className="flex flex-wrap gap-3 items-end">
          <select
            value={eventFilter}
            onChange={(e) => { setEventFilter(e.target.value); setPage(1) }}
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            style={{ boxSizing: 'border-box' }}
          >
            <option value="">All Events</option>
            {events.map((ev) => (
              <option key={String(ev.id)} value={String(ev.id)}>{ev.title}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            style={{ boxSizing: 'border-box' }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{error}</div>
      )}

      {loading && !results && (
        <div className="text-center py-16 text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading waitlist...
        </div>
      )}

      {results && results.totalDocs === 0 && (
        <Card className="text-center" padding>
          <p className="text-text-light">No waitlist entries found.</p>
        </Card>
      )}

      {results && results.totalDocs > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-soft-beige/50 text-left">
                  <th className="px-4 py-3 font-semibold text-text-light">Event</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Email</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Name</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Phone</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Persons</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Status</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Notified</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Created</th>
                </tr>
              </thead>
              <tbody>
                {results.docs.map((entry) => (
                  <tr key={String(entry.id)} className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-lunar-green font-semibold">{entry.eventTitle || '\u2014'}</td>
                    <td className="px-4 py-3 text-xs text-lunar-green font-mono">{entry.email}</td>
                    <td className="px-4 py-3 text-xs text-lunar-green">{entry.name}</td>
                    <td className="px-4 py-3 text-xs text-text-light">{entry.phone || '\u2014'}</td>
                    <td className="px-4 py-3 text-center text-xs text-lunar-green">{entry.persons}</td>
                    <td className="px-4 py-3">
                      <Badge variant={entry.status}>{entry.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-light">
                      {entry.notifiedAt
                        ? new Date(entry.notifiedAt).toLocaleString('en-MT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-light">
                      {new Date(entry.createdAt).toLocaleDateString('en-MT')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={results.page}
            totalPages={results.totalPages}
            totalDocs={results.totalDocs}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
