/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/console/Button'
import Badge from '@/components/console/Badge'
import Card from '@/components/console/Card'

interface AttendeeRow {
  id: string | number
  reference: string
  leadAttendeeName: string
  email: string
  phone: string | null
  persons: number
  status: string
  dietaryNotes: string | null
}

interface EventInfo {
  id: string | number
  title: string
  date: string
  capacity: number
}

interface SearchResult {
  docs: AttendeeRow[]
  totalDocs: number
}

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString('en-MT', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleString('en-MT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function EventAttendeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [attendees, setAttendees] = useState<AttendeeRow[]>([])
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch event info
      const evRes = await fetch('/console/api/events?limit=200')
      if (evRes.status === 401) { router.push('/admin/login'); return }
      if (evRes.ok) {
        const evData = await evRes.json()
        const found = evData.docs?.find((e: EventInfo) => String(e.id) === String(id))
        if (found) setEventInfo(found)
      }

      // Fetch bookings for this event
      const params = new URLSearchParams()
      params.set('event', id)
      params.set('limit', '200')
      params.set('page', '1')
      const res = await fetch('/console/api/bookings?' + params.toString())
      if (res.status === 401) { router.push('/admin/login'); return }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to load attendees')
      }
      const data: SearchResult = await res.json()
      setAttendees(data.docs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { void fetchData() }, [fetchData])

  const totalPersons = attendees.reduce((sum, a) => sum + (a.persons || 0), 0)
  const bookingCount = attendees.length
  const capacity = eventInfo?.capacity || 0

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-text-light">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
        Loading attendee list...
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <Button variant="secondary" size="sm" onClick={() => router.push('/console/events')}>
          &larr; Back to Events
        </Button>
        <Card className="mt-4 text-center" padding>
          <p className="text-[#9C4E2F]">{error}</p>
        </Card>
      </div>
    )
  }

  return (
    <div>
      {/* Navigation */}
      <div className="mb-6 flex items-center gap-3 no-print">
        <Button variant="secondary" size="sm" onClick={() => router.push('/console/events')}>
          &larr; Back to Events
        </Button>
      </div>

      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-black text-lunar-green tracking-tight mb-1">
          {eventInfo?.title || 'Event Attendee Roster'}
        </h1>
        {eventInfo && (
          <p className="text-sm text-text-light">
            {formatDate(eventInfo.date)}
            {capacity > 0 && ' \u2022 ' + 'Capacity: ' + capacity}
          </p>
        )}
      </header>

      {/* Summary */}
      <Card className="mb-6" padding>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-lunar-green">
              <span className="font-bold text-lg">{totalPersons}</span> of{' '}
              <span className="font-bold">{capacity || '\u2014'}</span> seats booked
              {' '}across <span className="font-bold">{bookingCount}</span> booking{bookingCount !== 1 ? 's' : ''}
            </p>
          </div>
          <Button onClick={handlePrint} variant="secondary" size="sm">
            Print Roster
          </Button>
        </div>
      </Card>

      {attendees.length === 0 ? (
        <Card className="text-center" padding>
          <p className="text-text-light">No attendees found for this event.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-soft-beige/50 text-left">
                <th className="px-4 py-3 font-semibold text-text-light">#</th>
                <th className="px-4 py-3 font-semibold text-text-light">Attendee</th>
                <th className="px-4 py-3 font-semibold text-text-light">Contact</th>
                <th className="px-4 py-3 font-semibold text-text-light text-center">Persons</th>
                <th className="px-4 py-3 font-semibold text-text-light">Status</th>
                <th className="px-4 py-3 font-semibold text-text-light text-center">Dietary</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((a, idx) => (
                <tr
                  key={String(a.id)}
                  className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors cursor-pointer"
                  onClick={() => router.push('/console/bookings/' + a.id)}
                >
                  <td className="px-4 py-3 text-xs text-text-light">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-lunar-green">{a.leadAttendeeName}</div>
                    <div className="text-xs font-mono text-text-light">{a.reference}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-lunar-green">{a.email}</div>
                    {a.phone && <div className="text-xs text-text-light">{a.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-center text-lunar-green font-semibold">{a.persons}</td>
                  <td className="px-4 py-3">
                    <Badge variant={a.status}>{a.status.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {a.dietaryNotes ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-matte-gold" title={a.dietaryNotes}>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Yes
                      </span>
                    ) : (
                      <span className="text-xs text-text-light">&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
