/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/console/Button'
import Badge from '@/components/console/Badge'
import Card from '@/components/console/Card'
import Modal from '@/components/console/Modal'
import { Pagination } from '@/components/console/DataTable'

interface EventRow {
  id: string | number
  title: string
  serviceId: string | number | null
  serviceName: string | null
  date: string
  startTime: string
  endTime: string
  capacity: number
  pricePerPerson: number
  autoCloseHoursAfter: number | null
  locationRef: string
  status: string
  fullyBookedOverride: boolean
  seriesId: string | null
  booked: number
  checkedIn: number
  remaining: number
  createdAt: string
}

interface ServiceOption {
  id: string | number
  name: string
}

interface SearchResult {
  docs: EventRow[]
  totalDocs: number
  page: number
  totalPages: number
}

// Event times are stored as the wall-clock time the admin entered,
// written as literal UTC ("19:00" -> "…T19:00:00.000Z"). Read them back
// with UTC slicing -- never the browser timezone -- so the console shows
// exactly what was entered and matches the public (server-rendered) site.
function isoOf(v: string | null): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function dayOf(v: string | null): string {
  return isoOf(v)?.slice(0, 10) ?? ''
}

function hhmm(v: string | null): string {
  return isoOf(v)?.slice(11, 16) ?? ''
}

function formatDate(v: string | null): string {
  const day = dayOf(v)
  if (!day) return ''
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-MT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export default function ConsoleEventsPage() {
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Services for form dropdown
  const [services, setServices] = useState<ServiceOption[]>([])

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', serviceId: '', date: '', startTime: '', endTime: '',
    capacity: '', pricePerPerson: '', locationRef: '', status: 'scheduled' as string,
    fullyBookedOverride: false, autoCloseHoursAfter: '',
  })
  // Recurrence (create, or edit of a NON-series event): 'none' | 'weekly' | 'biweekly' | 'monthly' + until date
  const [repeatFreq, setRepeatFreq] = useState('none')
  const [repeatUntil, setRepeatUntil] = useState('')
  // Series edit scope (edit only, when the event belongs to a series):
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null)
  const [applyTo, setApplyTo] = useState<'single' | 'future'>('single')

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/console/api/events?page=${page}&limit=25`)
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) throw new Error('Failed to load events')
      setResults(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    } finally { setLoading(false) }
  }, [page])

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('/console/api/services?limit=200')
      if (!res.ok) return
      const data = await res.json()
      if (data.docs) setServices(data.docs)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])
  useEffect(() => { void fetchServices() }, [fetchServices])

  const resetForm = () => {
    setForm({ title: '', serviceId: '', date: '', startTime: '', endTime: '',
      capacity: '', pricePerPerson: '', locationRef: '', status: 'scheduled', fullyBookedOverride: false, autoCloseHoursAfter: '' })
    setEditingId(null)
    setFormError(null)
    setRepeatFreq('none')
    setRepeatUntil('')
    setEditingSeriesId(null)
    setApplyTo('single')
  }

  const openCreate = () => {
    resetForm()
    setModalOpen(true)
  }

  const openEdit = (ev: EventRow) => {
    setEditingId(ev.id)
    setEditingSeriesId(ev.seriesId || null)
    setApplyTo('single')
    setRepeatFreq('none')
    setRepeatUntil('')
    setForm({
      title: ev.title,
      serviceId: String(ev.serviceId || ''),
      date: dayOf(ev.date),
      startTime: hhmm(ev.startTime),
      endTime: hhmm(ev.endTime),
      capacity: String(ev.capacity),
      pricePerPerson: String(ev.pricePerPerson),
      locationRef: ev.locationRef,
      status: ev.status,
      fullyBookedOverride: ev.fullyBookedOverride,
      autoCloseHoursAfter: ev.autoCloseHoursAfter != null ? String(ev.autoCloseHoursAfter) : '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.serviceId || !form.date || !form.locationRef.trim()) {
      setFormError('Title, service, date, and location are required.')
      return
    }
    if (!form.startTime.trim() || !form.endTime.trim()) {
      setFormError('Start time and end time are required.')
      return
    }
    // End earlier than start is allowed: the event runs past midnight.
    if (!/^\d{2}:\d{2}$/.test(form.startTime) || !/^\d{2}:\d{2}$/.test(form.endTime)) {
      setFormError('Enter start and end times as HH:MM.')
      return
    }
    const capacityNum = parseInt(form.capacity, 10)
    if (!form.capacity.trim() || !Number.isFinite(capacityNum) || capacityNum < 1) {
      setFormError('Capacity must be a number of at least 1.')
      return
    }
    const priceNum = parseFloat(form.pricePerPerson)
    if (!form.pricePerPerson.trim() || !Number.isFinite(priceNum) || priceNum < 0) {
      setFormError('Price per person must be a number of 0 or more.')
      return
    }
    // Cancelling an event cancels and fully refunds its bookings (Events.ts cascade).
    const original = editingId ? results?.docs.find((e) => String(e.id) === String(editingId)) : undefined
    if (original && original.status !== 'cancelled' && form.status === 'cancelled') {
      const series = editingSeriesId && applyTo === 'future'
        ? ' The same happens for every later event in the series.'
        : ''
      if (!confirm(`Cancel "${original.title}"? Its ${original.booked} active booking${original.booked === 1 ? '' : 's'} will be cancelled and fully refunded. This cannot be undone.${series}`)) return
    }
    setSaveLoading(true)
    setFormError(null)
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        service: form.serviceId,
        // POST expects serviceId; PATCH allowlists 'service'. Send both.
        serviceId: form.serviceId,
        date: form.date,
        // Date is the single source of the day; Start/End are time-of-day
        // only and are composed onto it -- the API re-composes onto each
        // occurrence's own date.
        startTime: `${form.date}T${form.startTime}`,
        endTime: `${form.date}T${form.endTime}`,
        capacity: capacityNum,
        pricePerPerson: priceNum,
        locationRef: form.locationRef,
        status: form.status,
        fullyBookedOverride: form.fullyBookedOverride,
        autoCloseHoursAfter: form.autoCloseHoursAfter === '' ? null : Number(form.autoCloseHoursAfter),
      }
      if (repeatFreq !== 'none' && !editingSeriesId) {
        if (!repeatUntil) {
          setFormError('Choose a "repeat until" date for the recurring series.')
          setSaveLoading(false)
          return
        }
        body.recurrence = { frequency: repeatFreq, until: repeatUntil }
      }
      if (editingId && editingSeriesId) {
        body.applyTo = applyTo
      }
      const url = editingId ? `/console/api/events/${editingId}` : '/console/api/events'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        // The event itself was saved (now carrying the seriesId): refresh
        // the list so the series glyph shows even though some copies failed.
        if (data?.error === 'series_partial') void fetchData()
        throw new Error(data?.message || data?.error || 'Save failed')
      }
      setModalOpen(false)
      resetForm()
      void fetchData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    } finally { setSaveLoading(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/console/api/events/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (data?.error === 'has_bookings') {
          throw new Error(data.message || 'Cannot delete event with existing bookings.')
        }
        throw new Error(data?.error || 'Delete failed')
      }
      setDeleteTarget(null)
      void fetchData()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed')
    } finally { setDeleteLoading(false) }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-lunar-green tracking-tight">Events</h1>
          <p className="mt-1 text-sm text-text-light">Manage all events and schedules</p>
        </div>
        <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => window.open('/console/api/events/export', '_blank')}
            >
              Export CSV
            </Button>
            <Button onClick={openCreate}>+ New Event</Button>
          </div>
      </header>

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{error}</div>
      )}

      {loading && (
        <div className="text-center py-16 text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading events...
        </div>
      )}

      {results && results.totalDocs === 0 && (
        <Card className="text-center" padding>
          <p className="text-text-light">No events found. Create your first event above.</p>
        </Card>
      )}

      {results && results.totalDocs > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-soft-beige/50 text-left">
                  <th className="px-4 py-3 font-semibold text-text-light">Title</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Service</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Date</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Cap.</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Booked</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Rem.</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Status</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.docs.map((ev) => (
                  <tr key={String(ev.id)} className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors">
                    <td className="px-4 py-3 text-lunar-green font-semibold">{ev.title}</td>
                    <td className="px-4 py-3 text-text-light">{ev.serviceName || '-'}</td>
                    <td className="px-4 py-3 text-xs text-text-light">
                      {formatDate(ev.date)}
                      {ev.seriesId && (
                        <span title="Part of a recurring series" aria-label="Recurring series" className="ml-1 text-accent-text">&#8635;</span>
                      )}
                      <br />
                      {hhmm(ev.startTime)} &ndash; {hhmm(ev.endTime)}
                      {ev.autoCloseHoursAfter != null && ev.autoCloseHoursAfter > 0 && (
                        <span title="Bookings close this long before the start" className="ml-1 inline-block rounded-full bg-accent-text/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent-text">
                          closes {ev.autoCloseHoursAfter}h before
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-lunar-green">{ev.capacity}</td>
                    <td className="px-4 py-3 text-center text-lunar-green">{ev.booked}</td>
                    <td className="px-4 py-3 text-center text-lunar-green font-semibold">{ev.remaining}</td>
                    <td className="px-4 py-3"><Badge variant={ev.status}>{ev.status}</Badge></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(ev)} className="rounded-md border border-lunar-green px-2 py-0.5 text-[10px] font-semibold text-lunar-green hover:bg-lunar-green hover:text-white transition-colors">
                          Edit
                        </button>
                        <button
                          onClick={() => window.location.href = '/console/events/' + ev.id + '/attendees'}
                          className="rounded-md border border-accent-text px-2 py-0.5 text-[10px] font-semibold text-accent-text hover:bg-accent-text hover:text-white transition-colors"
                        >
                          Attendees
                        </button>
                        <button onClick={() => setDeleteTarget(ev)} className="rounded-md border border-terracotta px-2 py-0.5 text-[10px] font-semibold text-[#9C4E2F] hover:bg-terracotta hover:text-white transition-colors">
                          Delete
                        </button>
                      </div>
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

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); resetForm() }} title={editingId ? 'Edit Event' : 'New Event'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Title *</label>
            <input type="text" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Service *</label>
            <select value={form.serviceId} onChange={(e) => setForm(p => ({ ...p, serviceId: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}>
              <option value="">Select...</option>
              {services.map(s => <option key={String(s.id)} value={String(s.id)}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Date *</label>
            <input type="date" value={form.date} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }} />
          </div>

          {/* Recurrence -- create, or edit of a NON-series event (the edited
              event becomes the first of the series; only future dates are
              added). Generates independent event rows sharing a seriesId;
              each occurrence is editable/cancellable on its own afterwards. */}
          {!editingSeriesId && (
            <div className="rounded-lg border border-border bg-soft-beige/40 p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-lunar-green mb-1">Repeat</label>
                  <select value={repeatFreq} onChange={(e) => setRepeatFreq(e.target.value)}
                    className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                    style={{ boxSizing: 'border-box' }}>
                    <option value="none">Does not repeat</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                {repeatFreq !== 'none' && (
                  <div>
                    <label className="block text-sm font-semibold text-lunar-green mb-1">Repeat until *</label>
                    <input type="date" value={repeatUntil} min={form.date}
                      onChange={(e) => setRepeatUntil(e.target.value)}
                      className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                      style={{ boxSizing: 'border-box' }} />
                  </div>
                )}
              </div>
              {repeatFreq !== 'none' && (
                <p className="mt-2 text-xs text-text-light">
                  {editingId ? (
                    <>
                      This event keeps its date and bookings and becomes the first event of the
                      series. New dates are added from the next matching date that is today or
                      later &mdash; never in the past &mdash; up to the repeat-until date (max 52
                      events including this one). New dates start with no bookings.
                    </>
                  ) : (
                    <>
                      Creates one independent event per date (max 52), each at the same
                      start/end time on its own date. Each can be edited or cancelled
                      individually afterwards.
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Series edit scope -- only when editing an event that belongs
              to a recurring series. */}
          {editingId && editingSeriesId && (
            <div className="rounded-lg border border-matte-gold/40 bg-accent-text/5 p-3">
              <p className="text-sm font-semibold text-lunar-green mb-2">
                This event is part of a recurring series. Apply changes to:
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-lunar-green">
                  <input type="radio" name="applyTo" checked={applyTo === 'single'}
                    onChange={() => setApplyTo('single')} className="accent-lunar-green" />
                  This event only
                </label>
                <label className="flex items-center gap-2 text-sm text-lunar-green">
                  <input type="radio" name="applyTo" checked={applyTo === 'future'}
                    onChange={() => setApplyTo('future')} className="accent-lunar-green" />
                  This and future events
                </label>
              </div>
              {applyTo === 'future' && (
                <p className="mt-2 text-xs text-text-light">
                  Title, service, capacity, price, location, status and start/end
                  times propagate to later occurrences. Each occurrence keeps its
                  own date.
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Time of day only -- the Date field above is the single source
                of the day (and, for a series, each occurrence's own date).
                An end time earlier than the start means the event runs past
                midnight. */}
            <div>
              <label className="block text-sm font-semibold text-lunar-green mb-1">Start Time *</label>
              <input type="time" value={form.startTime} onChange={(e) => setForm(p => ({ ...p, startTime: e.target.value }))}
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                style={{ boxSizing: 'border-box' }} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-lunar-green mb-1">End Time *</label>
              <input type="time" value={form.endTime} onChange={(e) => setForm(p => ({ ...p, endTime: e.target.value }))}
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                style={{ boxSizing: 'border-box' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-lunar-green mb-1">Capacity *</label>
              <input type="number" min="1" value={form.capacity} onChange={(e) => setForm(p => ({ ...p, capacity: e.target.value }))}
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                style={{ boxSizing: 'border-box' }} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-lunar-green mb-1">Price/person (EUR) *</label>
              <input type="number" min="0" step="0.01" value={form.pricePerPerson} onChange={(e) => setForm(p => ({ ...p, pricePerPerson: e.target.value }))}
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                style={{ boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Location *</label>
            <input type="text" value={form.locationRef} onChange={(e) => setForm(p => ({ ...p, locationRef: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }} />
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-semibold text-lunar-green mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm(p => ({ ...p, status: e.target.value }))}
                className="rounded-lg border border-border px-3 py-2 text-sm text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                style={{ boxSizing: 'border-box' }}>
                <option value="scheduled">Scheduled</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-lunar-green" style={{ paddingTop: '1.5rem' }}>
              <input type="checkbox" checked={form.fullyBookedOverride}
                onChange={(e) => setForm(p => ({ ...p, fullyBookedOverride: e.target.checked }))}
                className="h-4 w-4 accent-lunar-green" />
              Fully Booked Override
            </label>
          </div>
          <div>
            <label htmlFor="auto-close-hours" className="block text-sm font-semibold text-lunar-green mb-1">
              Auto-close before (hours)
            </label>
            <input id="auto-close-hours" type="number" min="0" step="0.5" value={form.autoCloseHoursAfter}
              onChange={(e) => setForm(p => ({ ...p, autoCloseHoursAfter: e.target.value }))}
              placeholder="e.g. 2"
              aria-describedby="auto-close-help"
              className="w-40 rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }} />
            <p id="auto-close-help" className="mt-1 text-xs text-text-light">
              Stop accepting bookings this many hours before the experience starts. Leave empty for no cutoff.
            </p>
          </div>
          {formError && (
            <div className="rounded-lg border border-terracotta bg-terracotta/5 p-3 text-sm text-[#9C4E2F]">{formError}</div>
          )}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} loading={saveLoading}>
              {editingId ? 'Save Changes' : 'Create Event'}
            </Button>
            <Button variant="secondary" onClick={() => { setModalOpen(false); resetForm() }}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Event">
        {deleteTarget && (
          <div>
            <p className="text-sm text-lunar-green mb-2">
              Are you sure you want to delete <strong>{deleteTarget.title}</strong>?
            </p>
            {deleteTarget.booked > 0 ? (
              <div className="rounded-lg border-2 border-terracotta bg-terracotta/5 p-3 text-sm text-[#9C4E2F] mb-4">
                This event has {deleteTarget.booked} booking(s) and cannot be deleted.
                Cancel or reassign the bookings first.
              </div>
            ) : (
              <p className="text-xs text-text-light mb-4">This action cannot be undone.</p>
            )}
            {deleteError && (
              <div className="rounded-lg border border-terracotta bg-terracotta/5 p-3 text-sm text-[#9C4E2F] mb-4">{deleteError}</div>
            )}
            <div className="flex gap-3">
              {deleteTarget.booked === 0 && (
                <Button variant="danger" onClick={handleDelete} loading={deleteLoading}>Delete Event</Button>
              )}
              <Button variant="secondary" onClick={() => { setDeleteTarget(null); setDeleteError(null) }}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
