/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/console/Button'
import Badge from '@/components/console/Badge'
import Card from '@/components/console/Card'

interface BookingDetail {
  id: string | number
  reference: string
  eventId: string | number | null
  eventTitle: string | null
  eventDate: string | null
  leadAttendeeName: string
  email: string
  phone: string | null
  persons: number
  language: string
  status: string
  totalAmount: number
  checkedInAt: string | null
  checkInStaffName: string | null
  noShow: boolean
  refundStatus: string | null
  refundId: string | null
  dietaryNotes: string | null
  dietaryConsent: boolean
  paymentMethod: string | null
  couponCode: string | null
  createdAt: string
  updatedAt: string
  auditTrail: Array<{ id: string; action: string; detail: string; createdAt: string }>
  waitlistEntries: Array<{ id: string; email: string; name: string; persons: number; status: string; createdAt: string }>
}

function formatCurrency(cents: number): string {
  return `\u20AC${(cents / 100).toFixed(2)}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString('en-MT', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleString('en-MT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBooking = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/console/api/bookings?id=${id}`)
      if (res.status === 401) { router.push('/admin/login'); return }
      if (res.status === 404) { setError('Booking not found.'); return }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Fetch failed')
      }
      const data = await res.json()
      setBooking(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { void fetchBooking() }, [fetchBooking])

  if (loading) {
    return (
      <div className="text-center py-16 text-text-light">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
        Loading booking...
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div>
        <Button variant="secondary" size="sm" onClick={() => router.push('/console/bookings')}>
          &larr; Back to Bookings
        </Button>
        <Card className="mt-4 text-center" padding>
          <p className="text-[#9C4E2F]">{error || 'Booking not found.'}</p>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => router.push('/console/bookings')}>
          &larr; Back to Bookings
        </Button>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-black text-lunar-green tracking-tight mb-1">Booking Detail</h1>
        <p className="font-mono text-sm text-text-light">{booking.reference}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Core details */}
        <Card>
          <h2 className="text-sm font-bold text-lunar-green mb-4 uppercase tracking-wider">Details</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-light">Status</dt>
              <dd><Badge variant={booking.status}>{booking.status.replace('_', ' ')}</Badge></dd>
            </div>
            {booking.noShow && (
              <div className="flex justify-between">
                <dt className="text-text-light">No-Show</dt>
                <dd><Badge variant="failed">Marked as No-Show</Badge></dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-text-light">Event</dt>
              <dd className="text-right text-lunar-green font-semibold">
                {booking.eventTitle || '\u2014'}
                <div className="text-xs text-text-light">{formatDate(booking.eventDate)}</div>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-light">Attendee</dt>
              <dd className="text-right text-lunar-green font-semibold">{booking.leadAttendeeName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-light">Email</dt>
              <dd className="text-right text-lunar-green">{booking.email}</dd>
            </div>
            {booking.phone && (
              <div className="flex justify-between">
                <dt className="text-text-light">Phone</dt>
                <dd className="text-right text-lunar-green">{booking.phone}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-text-light">Persons</dt>
              <dd className="text-right text-lunar-green font-semibold">{booking.persons}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-light">Language</dt>
              <dd className="text-right text-lunar-green">{booking.language === 'mt' ? 'Malti' : 'English'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-light">Total</dt>
              <dd className="text-right text-lunar-green font-bold">{formatCurrency(booking.totalAmount)}</dd>
            </div>
            {booking.couponCode && (
              <div className="flex justify-between">
                <dt className="text-text-light">Coupon</dt>
                <dd className="text-right font-mono text-xs text-lunar-green">{booking.couponCode}</dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Check-in / Financial */}
        <Card>
          <h2 className="text-sm font-bold text-lunar-green mb-4 uppercase tracking-wider">Check-in &amp; Financial</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-light">Checked In</dt>
              <dd className="text-right text-lunar-green">{formatDateTime(booking.checkedInAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-light">Checked In By</dt>
              <dd className="text-right text-lunar-green">{booking.checkInStaffName || '\u2014'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-light">Payment Method</dt>
              <dd className="text-right">
                {booking.paymentMethod ? (
                  <Badge variant={booking.paymentMethod}>{booking.paymentMethod.replace('_', ' ')}</Badge>
                ) : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-light">Refund Status</dt>
              <dd className="text-right">
                {booking.refundStatus && booking.refundStatus !== 'none' ? (
                  <Badge variant={booking.refundStatus}>{booking.refundStatus}</Badge>
                ) : '\u2014'}
              </dd>
            </div>
            {booking.refundId && (
              <div className="flex justify-between">
                <dt className="text-text-light">Refund ID</dt>
                <dd className="text-right font-mono text-xs text-lunar-green">{booking.refundId}</dd>
              </div>
            )}
          </dl>
          {booking.dietaryNotes && (
            <div className="mt-4 border-t border-border pt-4">
              <h3 className="text-xs font-bold text-text-light mb-1">Dietary Notes</h3>
              <p className="text-sm text-lunar-green whitespace-pre-wrap">{booking.dietaryNotes}</p>
              <p className="text-xs text-text-light mt-1">Consent: {booking.dietaryConsent ? 'Yes' : 'No'}</p>
            </div>
          )}
        </Card>

        {/* Timestamps */}
        <Card>
          <h2 className="text-sm font-bold text-lunar-green mb-4 uppercase tracking-wider">Timestamps</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-light">Created</dt>
              <dd className="text-right text-lunar-green">{formatDateTime(booking.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-light">Updated</dt>
              <dd className="text-right text-lunar-green">{formatDateTime(booking.updatedAt)}</dd>
            </div>
          </dl>
        </Card>

        {/* Audit Trail */}
        <Card>
          <h2 className="text-sm font-bold text-lunar-green mb-4 uppercase tracking-wider">Audit Trail</h2>
          {booking.auditTrail.length === 0 ? (
            <p className="text-sm text-text-light">No audit entries recorded.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {booking.auditTrail.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border bg-background p-3 text-xs">
                  <div className="flex justify-between mb-1">
                    <Badge variant={entry.action}>{entry.action}</Badge>
                    <span className="text-text-light">{formatDateTime(entry.createdAt)}</span>
                  </div>
                  {entry.detail && <p className="text-lunar-green mt-1">{entry.detail}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Waitlist Entries for this Event */}
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-bold text-lunar-green mb-4 uppercase tracking-wider">
            Waitlist (Event: {booking.eventTitle || 'N/A'})
          </h2>
          {booking.waitlistEntries.length === 0 ? (
            <p className="text-sm text-text-light">No waitlist entries for this event.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-semibold text-text-light text-xs">Name</th>
                    <th className="px-3 py-2 font-semibold text-text-light text-xs">Email</th>
                    <th className="px-3 py-2 font-semibold text-text-light text-xs text-center">Persons</th>
                    <th className="px-3 py-2 font-semibold text-text-light text-xs">Status</th>
                    <th className="px-3 py-2 font-semibold text-text-light text-xs">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.waitlistEntries.map((w) => (
                    <tr key={w.id} className="border-b border-border/30 last:border-0">
                      <td className="px-3 py-2 text-lunar-green font-semibold">{w.name}</td>
                      <td className="px-3 py-2 text-text-light">{w.email}</td>
                      <td className="px-3 py-2 text-center text-lunar-green">{w.persons}</td>
                      <td className="px-3 py-2"><Badge variant={w.status}>{w.status}</Badge></td>
                      <td className="px-3 py-2 text-xs text-text-light">{formatDateTime(w.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
