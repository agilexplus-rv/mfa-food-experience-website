import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getAvailability } from '@/lib/availability'
import { BookingForm } from '@/components/booking/BookingForm'
import { WaitlistForm } from '@/components/waitlist/WaitlistForm'
import { formatPrice } from '@/lib/availability-types'
import { getCancellationPolicy } from '@/lib/policies/cancellation'
import { formatDay, formatTimeRange } from '@/lib/format-date'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

const getEvent = cache(async function getEvent(id: string) {
  const payload = await getPayload({ config })
  const event = await payload.findByID({ collection: 'events', id, overrideAccess: true }).catch((err) => {
    console.error('[book/[id]] Failed to fetch event:', err)
    return null
  })
  return event as {
    id: string | number
    title: string
    date: string
    startTime: string
    endTime: string
    capacity: number
    pricePerPerson: number
    locationRef: string
    status: 'scheduled' | 'cancelled' | 'completed'
    fullyBookedOverride?: boolean
  } | null
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const event = await getEvent(id)
  if (!event) return { title: 'Not found — Malta Food Experience' }
  return {
    title: `Book: ${event.title} — Malta Food Experience`,
    description: `Reserve your seat for ${event.title}.`,
  }
}

/**
 * /book/[id] — Phase 2 booking form entry point.
 *
 * Per ADR-002/003/004/005 + ADR-008 (compliance gate): shows the event
 * summary, collects attendee details + optional coupon, acquires a
 * seat hold on mount (via the client BookingForm component), and hands
 * off to Stripe Checkout on submit ("Pay now" per EU Legal D.5).
 *
 * Also fetches the CancellationPolicy Global to surface the
 * Article 6(1)(k) withdrawal-right disclosure directly in the
 * booking flow (EU Legal Action #5).
 */
export default async function BookEventPage({ params }: PageProps) {
  const { id } = await params
  const event = await getEvent(id)
  if (!event) notFound()

  const availability = await getAvailability(event.id)

  // Fetch cancellation policy for the withdrawal-right disclosure
  // and to know whether cancellations are enabled at all.
  const cancellationPolicy = await getCancellationPolicy().catch(() => null)

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <header className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-semibold uppercase tracking-wide text-matte-gold">
          Reserve your seat
        </span>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.02em] text-lunar-green sm:text-4xl">
          {event.title}
        </h1>
      </header>

      <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-sm">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-lunar-green/50">Date</dt>
            <dd className="font-semibold text-lunar-green">{formatDay(event.date, 'long')}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-lunar-green/50">Time</dt>
            <dd className="font-semibold text-lunar-green">{formatTimeRange(event.startTime, event.endTime)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-lunar-green/50">Per person</dt>
            <dd className="font-semibold text-lunar-green">{formatPrice(event.pricePerPerson)}</dd>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-lunar-green/50">Location</dt>
            <dd className="font-semibold text-lunar-green">{event.locationRef}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-10">
        {event.status !== 'scheduled' ? (
          <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-lunar-green">This event is no longer bookable</p>
            <p className="mt-2 text-sm text-text-light">
              {event.status === 'cancelled'
                ? 'This event has been cancelled.'
                : 'This event has already taken place.'}
            </p>
          </div>
        ) : availability.status === 'fully_booked' ? (
          <div className="space-y-6">
            <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center">
              <p className="text-lg font-semibold text-lunar-green">Fully booked</p>
              <p className="mt-2 text-sm text-text-light">
                All seats for this date have been reserved. Please check other upcoming dates.
              </p>
            </div>
            <WaitlistForm eventId={event.id} />
          </div>
        ) : (
          <BookingForm
            eventId={event.id}
            pricePerPerson={event.pricePerPerson}
            maxSeats={Math.min(20, availability.remaining)}
            withdrawalRightDisclosure={cancellationPolicy?.withdrawalRightDisclosure ?? null}
            cancellationEnabled={cancellationPolicy?.enabled ?? true}
          />
        )}
      </div>
    </section>
  )
}
