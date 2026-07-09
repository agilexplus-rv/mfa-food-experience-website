/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/console/Button'
import Badge from '@/components/console/Badge'
import Card from '@/components/console/Card'
import Modal from '@/components/console/Modal'
import { Pagination } from '@/components/console/DataTable'

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

export default function ConsoleBookingsPage() {
  const router = useRouter()
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<EventOption[]>([])

  // Filters
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  // Action states
  const [actionId, setActionId] = useState<string | number | null>(null)
  const [actionType, setActionType] = useState<string | null>(null)
  const {} = useState<Record<string, { action?: string }>>({})
  const [exportEventId, setExportEventId] = useState('')

  // Create booking modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    eventId: '',
    leadAttendeeName: '',
    email: '',
    phone: '',
    persons: '1',
    dietaryNotes: '',
  })
  const [createError, setCreateError] = useState<string | null>(null)

  const search = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(page))
      params.set('limit', '25')
      const res = await fetch(`/console/api/bookings?${params.toString()}`)
      if (res.status === 401) { router.push('/admin/login'); return }
      if (!res.ok) {
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
  }, [q, statusFilter, page, router])

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/console/api/events?limit=200')
      if (!res.ok) return
      const data = await res.json()
      if (data.docs?.length > 0) setEvents(data.docs)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { void search() }, [search])
  useEffect(() => { void fetchEvents() }, [fetchEvents])

  const handleAction = useCallback(async (b: BookingRow, action: 'cancel' | 'resend' | 'no-show') => {
    setActionId(b.id)
    setActionType(action)
    try {
      const res = await fetch(`/console/api/bookings/${b.id}?action=${action}`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `${action} failed`)
      void search()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionId(null)
      setActionType(null)
    }
  }, [search])

  const handleExportCSV = useCallback(() => {
    if (!exportEventId) return
    window.open(`/api/bookings/export?eventId=${exportEventId}`, '_blank')
  }, [exportEventId])

  const handleCreateBooking = async () => {
    if (!createForm.eventId.trim() || !createForm.leadAttendeeName.trim() || !createForm.email.trim()) {
      setCreateError('Event, name, and email are required.')
      return
    }
    setCreateError(null)
    try {
      const res = await fetch('/console/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: createForm.eventId,
          leadAttendeeName: createForm.leadAttendeeName.trim(),
          email: createForm.email.trim(),
          phone: createForm.phone.trim() || undefined,
          persons: parseInt(createForm.persons, 10) || 1,
          dietaryNotes: createForm.dietaryNotes.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Create failed')
      setCreateOpen(false)
      setCreateForm({ eventId: '', leadAttendeeName: '', email: '', phone: '', persons: '1', dietaryNotes: '' })
      void search()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Create failed')
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-lunar-green tracking-tight">Bookings</h1>
          <p className="mt-1 text-sm text-text-light">Manage all bookings across events</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ New Booking</Button>
      </header>

      {/* Filters */}
      <Card className="mb-6" padding>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search by reference, name, or email..."
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green placeholder:text-text-light/50 focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); void search() } }}
            />
          </div>
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
          <Button onClick={() => { setPage(1); void search() }} loading={loading}>
            Search
          </Button>

          {/* CSV Export */}
          {events.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={exportEventId}
                onChange={(e) => setExportEventId(e.target.value)}
                className="rounded-lg border border-border px-3 py-2.5 text-xs text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                style={{ boxSizing: 'border-box' }}
              >
                <option value="">Export CSV...</option>
                {events.map((ev) => (
                  <option key={String(ev.id)} value={String(ev.id)}>{ev.title} ({formatDate(ev.date)})</option>
                ))}
              </select>
              <Button variant="secondary" size="sm" onClick={handleExportCSV} disabled={!exportEventId}>
                Export
              </Button>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{error}</div>
      )}

      {loading && !results && (
        <div className="text-center py-16 text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading bookings...
        </div>
      )}

      {results && results.totalDocs === 0 && (
        <Card className="text-center" padding>
          <p className="text-text-light">No bookings found.</p>
        </Card>
      )}

      {results && results.totalDocs > 0 && (
        <>
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
                  <th className="px-4 py-3 font-semibold text-text-light">By</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.docs.map((b) => {
                  const canNoShow = b.status === 'confirmed' && !b.checkedInAt && !b.noShow
                  return (
                    <tr
                      key={String(b.id)}
                      className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/console/bookings/${b.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-lunar-green">{b.reference}</td>
                      <td className="px-4 py-3 text-lunar-green">
                        <div>{b.eventTitle || '\u2014'}</div>
                        <div className="text-xs text-text-light">{formatDate(b.eventDate)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-lunar-green">{b.leadAttendeeName}</div>
                        <div className="text-xs text-text-light">{b.email}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-lunar-green">{b.persons}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={b.status}>{b.status.replace('_', ' ')}</Badge>
                          {b.noShow && <Badge variant="failed">NO-SHOW</Badge>}
                          {b.refundStatus && b.refundStatus !== 'none' && (
                            <Badge variant={b.refundStatus}>refund: {b.refundStatus}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-lunar-green">
                        {formatCurrency(b.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-light">{formatDateTime(b.checkedInAt)}</td>
                      <td className="px-4 py-3 text-xs text-text-light">{b.checkInStaffName || '\u2014'}</td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {b.status !== 'cancelled' && (
                            <button
                              onClick={() => handleAction(b, 'cancel')}
                              disabled={actionId === b.id}
                              className="rounded-md border border-terracotta px-2 py-0.5 text-[10px] font-semibold text-[#9C4E2F] hover:bg-terracotta hover:text-white disabled:opacity-40 transition-colors"
                            >
                              {actionId === b.id && actionType === 'cancel' ? '...' : 'Cancel'}
                            </button>
                          )}
                          {b.status === 'confirmed' && (
                            <button
                              onClick={() => handleAction(b, 'resend')}
                              disabled={actionId === b.id}
                              className="rounded-md border border-lunar-green px-2 py-0.5 text-[10px] font-semibold text-lunar-green hover:bg-lunar-green hover:text-white disabled:opacity-40 transition-colors"
                            >
                              {actionId === b.id && actionType === 'resend' ? '...' : 'Resend'}
                            </button>
                          )}
                          {canNoShow && (
                            <button
                              onClick={() => handleAction(b, 'no-show')}
                              disabled={actionId === b.id}
                              className="rounded-md border border-matte-gold px-2 py-0.5 text-[10px] font-semibold text-matte-gold hover:bg-matte-gold hover:text-white disabled:opacity-40 transition-colors"
                            >
                              {actionId === b.id && actionType === 'no-show' ? '...' : 'No-show'}
                            </button>
                          )}
                          {b.status === 'cancelled' && (
                            <span className="text-[10px] text-text-light">{'\u2014'}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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

      {/* Create booking modal */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setCreateError(null) }} title="New Booking">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Event *</label>
            <select
              value={createForm.eventId}
              onChange={(e) => setCreateForm(prev => ({ ...prev, eventId: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            >
              <option value="">Select event...</option>
              {events.map((ev) => (
                <option key={String(ev.id)} value={String(ev.id)}>{ev.title} ({formatDate(ev.date)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Lead Attendee Name *</label>
            <input
              type="text"
              value={createForm.leadAttendeeName}
              onChange={(e) => setCreateForm(prev => ({ ...prev, leadAttendeeName: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Email *</label>
            <input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Phone</label>
            <input
              type="text"
              value={createForm.phone}
              onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Persons *</label>
            <input
              type="number"
              min="1"
              value={createForm.persons}
              onChange={(e) => setCreateForm(prev => ({ ...prev, persons: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Dietary Notes</label>
            <textarea
              value={createForm.dietaryNotes}
              onChange={(e) => setCreateForm(prev => ({ ...prev, dietaryNotes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
          </div>
          {createError && (
            <div className="rounded-lg border border-terracotta bg-terracotta/5 p-3 text-sm text-[#9C4E2F]">{createError}</div>
          )}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleCreateBooking}>Create Booking</Button>
            <Button variant="secondary" onClick={() => { setCreateOpen(false); setCreateError(null) }}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
