/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Badge from '@/components/console/Badge'
import Button from '@/components/console/Button'
import Card from '@/components/console/Card'
import { FilterBar, FilterSelect } from '@/components/console/FilterBar'
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
  convertedAt: string | null
  archivedAt: string | null
  expiredAt: string | null
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
  { value: 'converted', label: 'Converted' },
  { value: 'archived', label: 'Archived' },
  { value: 'expired', label: 'Expired' },
]

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** When the entry reached its current status, for statuses that record it. */
function statusSince(e: WaitlistEntry): string | null {
  const at = e.status === 'converted' ? e.convertedAt
    : e.status === 'archived' ? e.archivedAt
    : e.status === 'expired' ? e.expiredAt
    : null
  return at ? new Date(at).toLocaleDateString('en-MT', { day: 'numeric', month: 'short', year: 'numeric' }) : null
}

export default function WaitlistPage() {
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<EventOption[]>([])
  const [eventFilter, setEventFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [archiving, setArchiving] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // Bumped to reload the list with the current filters after an action.
  const [refreshKey, setRefreshKey] = useState(0)

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
      setSelected(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [eventFilter, statusFilter, page])

  useEffect(() => { fetchWaitlist() }, [fetchWaitlist, refreshKey])

  // Expire entries past the retention period in Site Settings. `silent` is
  // the page-load run: errors are ignored and only real changes are shown.
  const runCleanup = useCallback(async (silent: boolean) => {
    if (!silent) {
      setCleaning(true)
      setNotice(null)
    }
    try {
      const res = await fetch('/console/api/waitlist/cleanup', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || data?.error || 'Cleanup failed')
      const months = plural(data.retentionMonths, 'month', 'months')
      if (data.cleaned > 0) {
        setNotice(`Expired ${plural(data.cleaned, 'waitlist entry', 'waitlist entries')} older than ${months}.`)
        setRefreshKey((k) => k + 1)
      } else if (!silent) {
        setNotice(`Nothing to clean up: no active entries are older than ${months}.`)
      }
    } catch (err) {
      if (!silent) alert(err instanceof Error ? err.message : 'Cleanup failed')
    } finally {
      if (!silent) setCleaning(false)
    }
  }, [])

  // Best-effort cleanup on page load; the page works the same if it fails.
  useEffect(() => { void runCleanup(true) }, [runCleanup])

  const archive = useCallback(async (ids: (string | number)[]) => {
    if (ids.length === 0) return
    if (!confirm(`Archive ${plural(ids.length, 'waitlist entry', 'waitlist entries')}? This marks them as archived (GDPR-compliant data retention).`)) return
    setArchiving(true)
    setNotice(null)
    try {
      const res = await fetch('/console/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', ids }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || data?.error || 'Archive failed')
      setNotice(`Archived ${plural(data.archived, 'waitlist entry', 'waitlist entries')}.${data.failed ? ` ${data.failed} could not be archived.` : ''}`)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Archive failed')
    } finally {
      setArchiving(false)
    }
  }, [])

  // Selection covers the current page; archived rows can't be selected.
  const selectable = results?.docs.filter((e) => e.status !== 'archived') ?? []
  const allSelected = selectable.length > 0 && selectable.every((e) => selected.has(String(e.id)))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((e) => String(e.id))))
  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

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

      {/* Filters -- shared FilterBar primitives: uniform 40px control
          height, one border/focus treatment, brand select chevron. */}
      <Card className="mb-6" padding>
        <FilterBar>
          <FilterSelect
            label="Event"
            value={eventFilter}
            onChange={(v) => { setEventFilter(v); setPage(1) }}
            options={[
              { value: '', label: 'All Events' },
              ...events.map((ev) => ({ value: String(ev.id), label: ev.title })),
            ]}
            className="w-64"
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
            options={STATUS_OPTIONS}
            className="w-44"
          />

          {/* Actions -- right-aligned zone */}
          <div className="ml-auto flex items-end gap-2 border-l border-border pl-3">
            <Button
              onClick={() => void archive([...selected])}
              disabled={selected.size === 0}
              loading={archiving}
            >
              Archive selected{selected.size > 0 ? ` (${selected.size})` : ''}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void runCleanup(false)}
              loading={cleaning}
              title="Expire entries older than the waitlist retention period in Site Settings"
            >
              Clean up expired
            </Button>
          </div>
        </FilterBar>
      </Card>

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{error}</div>
      )}

      {notice && (
        <div className="rounded-xl border-2 border-lunar-green bg-lunar-green/5 p-4 text-sm text-lunar-green mb-4" role="status">
          {notice}
        </div>
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
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all entries on this page"
                      checked={allSelected}
                      disabled={selectable.length === 0}
                      onChange={toggleAll}
                      className="h-4 w-4 accent-lunar-green"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold text-text-light">Event</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Email</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Name</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Phone</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Persons</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Status</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Notified</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Created</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.docs.map((entry) => (
                  <tr key={String(entry.id)} className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${entry.email}`}
                        checked={selected.has(String(entry.id))}
                        disabled={entry.status === 'archived'}
                        onChange={() => toggleOne(String(entry.id))}
                        className="h-4 w-4 accent-lunar-green"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-lunar-green font-semibold">{entry.eventTitle || '-'}</td>
                    <td className="px-4 py-3 text-xs text-lunar-green font-mono">{entry.email}</td>
                    <td className="px-4 py-3 text-xs text-lunar-green">{entry.name}</td>
                    <td className="px-4 py-3 text-xs text-text-light">{entry.phone || '-'}</td>
                    <td className="px-4 py-3 text-center text-xs text-lunar-green">{entry.persons}</td>
                    <td className="px-4 py-3">
                      <Badge variant={entry.status}>{entry.status}</Badge>
                      {statusSince(entry) && (
                        <div className="mt-0.5 text-[10px] text-text-light">{statusSince(entry)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-light">
                      {entry.notifiedAt
                        ? new Date(entry.notifiedAt).toLocaleString('en-MT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-light">
                      {new Date(entry.createdAt).toLocaleDateString('en-MT')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.status !== 'archived' ? (
                        <button
                          onClick={() => void archive([entry.id])}
                          disabled={archiving}
                          className="rounded-md border border-lunar-green px-2 py-0.5 text-[10px] font-semibold text-lunar-green hover:bg-lunar-green hover:text-white disabled:opacity-40 transition-colors"
                        >
                          Archive
                        </button>
                      ) : (
                        <span className="text-[10px] text-text-light">{'-'}</span>
                      )}
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
