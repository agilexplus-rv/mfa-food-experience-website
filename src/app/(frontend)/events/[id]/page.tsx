import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'

import { getAvailability } from '@/lib/availability'
import { formatPrice } from '@/lib/availability-types'
import { formatDay, formatTimeRange } from '@/lib/format-date'
import { isEventBookable } from '@/lib/events/auto-close'
import { getMediaUrl } from '@/lib/payload'
import { richTextToHtml } from '@/lib/richtext'
import { MtText } from '@/components/i18n/MtText'
import type { MediaRelation } from '@/payload-types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

interface ServiceRelation {
  id: string | number
  name: string
  visible?: boolean
  description?: unknown
  imagery?: MediaRelation
  slug?: string
}

interface EventDetail {
  id: string | number
  title: string
  date: string
  startTime: string
  endTime: string
  pricePerPerson: number
  locationRef: string
  status: 'scheduled' | 'cancelled' | 'completed'
  capacity: number
  fullyBookedOverride?: boolean
  autoCloseHoursAfter?: number | null
  seriesId?: string | null
  service?: string | number | ServiceRelation | null
}

const getEvent = cache(async function getEvent(id: string) {
  const payload = await getPayload({ config })
  const event = await payload
    .findByID({ collection: 'events', id, depth: 2, overrideAccess: true })
    .catch((err) => {
      console.error('[events/[id]] Failed to fetch event:', err)
      return null
    })
  return event as unknown as EventDetail | null
})

function resolvedService(event: EventDetail): ServiceRelation | null {
  return event.service && typeof event.service === 'object' ? event.service : null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const event = await getEvent(id)
  if (!event) return { title: 'Not found | Malta Food Experience' }
  return {
    title: `${event.title} | Malta Food Experience`,
    description: `${event.title} — ${formatDay(event.date, 'long')}, ${formatTimeRange(event.startTime, event.endTime)}.`,
  }
}

/**
 * /events/[id] — the event's own public page.
 *
 * The Events collection has no description/image of its own; both are
 * resolved from the populated `service` relation (depth 2). Replaces the
 * former "Read more" modal — clicking through from a card now lands here,
 * with the option to proceed to /book/[id].
 */
export default async function EventPage({ params }: PageProps) {
  const { id } = await params
  const event = await getEvent(id)
  if (!event) notFound()

  const service = resolvedService(event)
  // Events of hidden services must not resolve publicly.
  if (service && service.visible === false) notFound()

  const imageUrl = service ? getMediaUrl(service.imagery ?? null) ?? undefined : undefined
  const imageAlt =
    (service && typeof service.imagery === 'object' && service.imagery?.alt) || event.title
  const descriptionHtml = service ? richTextToHtml(service.description) || undefined : undefined

  const availability = await getAvailability(event.id)
  const bookable = isEventBookable(event)

  let siblings: { id: string | number; date: string; startTime: string; endTime: string }[] = []
  if (event.seriesId) {
    const payload = await getPayload({ config })
    const today = new Date().toISOString().slice(0, 10)
    const { docs } = await payload.find({
      collection: 'events',
      where: {
        and: [
          { seriesId: { equals: event.seriesId } },
          { id: { not_equals: event.id } },
          { status: { equals: 'scheduled' } },
          { date: { greater_than_equal: today } },
        ],
      },
      sort: 'date',
      limit: 6,
      depth: 0,
      overrideAccess: true,
    })
    siblings = docs as unknown as typeof siblings
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <header className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-text">
          Experience
        </span>
        {service && (
          <p className="mt-2 text-sm font-semibold text-lunar-green">
            {service.slug ? (
              <Link href={`/services/${service.slug}`} className="hover:text-terracotta-dark focus:outline-2 focus:outline-offset-2 focus:outline-lunar-green">
                {service.name}
              </Link>
            ) : (
              service.name
            )}
          </p>
        )}
        <h1 className="mt-3 text-3xl font-black tracking-[-0.02em] text-lunar-green sm:text-4xl">
          {event.title}
        </h1>
      </header>

      {imageUrl && (
        <div className="mx-auto mt-8 aspect-[16/9] max-w-2xl overflow-hidden rounded-xl shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={imageAlt} className="h-full w-full object-cover" />
        </div>
      )}

      {descriptionHtml && (
        <div
          className="prose mx-auto mt-6 max-w-2xl text-text-light prose-headings:text-lunar-green prose-strong:text-lunar-green prose-a:text-terracotta-dark"
          dangerouslySetInnerHTML={{ __html: descriptionHtml }}
        />
      )}

      <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-sm">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">Date</dt>
            <dd className="font-semibold text-lunar-green">{formatDay(event.date, 'long')}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">Time</dt>
            <dd className="font-semibold text-lunar-green">{formatTimeRange(event.startTime, event.endTime)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">Per person</dt>
            <dd className="font-semibold text-lunar-green">{formatPrice(event.pricePerPerson)} inc. VAT</dd>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">Location</dt>
            <dd className="font-semibold text-lunar-green">{event.locationRef}</dd>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">Availability</dt>
            <dd className="font-semibold text-lunar-green">
              {availability.status === 'fully_booked'
                ? 'Fully booked'
                : `${availability.remaining} seat${availability.remaining === 1 ? '' : 's'} left`}
            </dd>
          </div>
        </dl>
      </div>

      {siblings.length > 0 && (
        <div className="mx-auto mt-8 max-w-2xl">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-light">
            Other dates in this series
          </h2>
          <ul className="mt-3 space-y-2">
            {siblings.map((sib) => (
              <li key={sib.id}>
                <Link
                  href={`/events/${sib.id}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-accent-text hover:text-lunar-green focus:outline-2 focus:outline-offset-2 focus:outline-lunar-green"
                >
                  {formatDay(sib.date)} · {formatTimeRange(sib.startTime, sib.endTime)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mx-auto mt-10 max-w-2xl">
        {event.status === 'cancelled' ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-lunar-green">This experience has been cancelled.</p>
          </div>
        ) : event.status === 'completed' ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-lunar-green">This experience has already taken place.</p>
          </div>
        ) : !bookable ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-lunar-green">Bookings are closed for this experience</p>
            <p className="mt-2 text-sm text-text-light">
              {event.autoCloseHoursAfter != null && event.autoCloseHoursAfter > 0
                ? `Bookings for this experience close ${event.autoCloseHoursAfter} hour${event.autoCloseHoursAfter === 1 ? '' : 's'} before it starts.`
                : 'This experience has already started.'}
            </p>
          </div>
        ) : availability.status === 'fully_booked' ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-lunar-green">Fully booked</p>
            <p className="mt-2 text-sm text-text-light">
              All seats for this date have been reserved. Please check other upcoming dates.
            </p>
            <Link
              href={`/book/${event.id}`}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-terracotta-dark px-6 py-3 text-base font-bold text-white transition-colors hover:bg-terracotta/85 focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
            >
              <MtText en="Join the waitlist" mt="Ingħaqad mal-lista tal-istennija" />
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <Link
              href={`/book/${event.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-terracotta-dark px-6 py-3 text-base font-bold text-white transition-colors hover:bg-terracotta/85 focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
            >
              <MtText en="Book Now" mt="Ibbukkja Issa" />
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        )}
      </div>

      <div className="mx-auto mt-8 max-w-2xl text-center">
        <Link
          href="/services"
          className="text-sm font-semibold text-text-light hover:text-lunar-green focus:outline-2 focus:outline-offset-2 focus:outline-lunar-green"
        >
          &larr; Back to experiences
        </Link>
      </div>
    </section>
  )
}
