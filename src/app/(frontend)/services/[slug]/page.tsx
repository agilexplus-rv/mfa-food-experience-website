import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EventGrid, type GridEvent } from '@/components/services/EventGrid'
import { ServiceNotAvailable } from '@/components/services/ServiceNotAvailable'
import { getServiceBySlug, getServiceEvents } from '@/lib/services/queries'

export const revalidate = 60
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const service = await getServiceBySlug(slug)
  if (!service) return { title: 'Not found — Malta Food Experience' }
  return {
    title: `${service.name} — Malta Food Experience`,
    description: `Upcoming ${service.name} dates, prices, and availability.`,
  }
}

/**
 * Dynamic service route.
 *
 * FR-1.3: a service with `visible=false` (e.g. Tastings) renders the
 * "not available" state — the URL still resolves, no 404 or redirect.
 * FR-1.5: a visible service renders a grid of upcoming scheduled
 * events, filterable by month (client-side via EventGrid/MonthFilter).
 *
 * Availability: remaining = capacity − booked − active holds (FR-2.3/2.4),
 * computed server-side via getAvailabilityForEvents and passed to the
 * client grid keyed by String(eventId).
 */
export default async function ServicePage({ params }: PageProps) {
  const { slug } = await params
  const service = await getServiceBySlug(slug)
  if (!service) notFound()

  if (!service.visible) {
    return <ServiceNotAvailable serviceName={service.name} />
  }

  const { events, availability, description, imageryUrl, imageryAlt } = await getServiceEvents(service.id)
  const gridEvents: GridEvent[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    pricePerPerson: e.pricePerPerson,
    locationRef: e.locationRef,
    imageUrl: imageryUrl,
    imageAlt: imageryAlt,
    serviceHref: `/services/${slug}`,
  }))

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <header className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-text">
          Experience
        </span>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.02em] text-lunar-green sm:text-5xl">
          {service.name}
        </h1>
        {description && (
          <p className="mt-4 text-lg leading-relaxed text-text-light max-w-2xl mx-auto">
            {description}
          </p>
        )}
        <p className={[
          'text-lg leading-relaxed text-text-light',
          description ? 'mt-2' : 'mt-4',
        ].join(' ')}>
          Browse upcoming dates and reserve your seat. New sessions are added
          throughout the season.
        </p>
        {/* Service image */}
        {imageryUrl && (
          <div className="mt-8 mx-auto max-w-2xl overflow-hidden rounded-xl shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageryUrl}
              alt={imageryAlt || service.name}
              className="w-full h-auto object-cover"
            />
          </div>
        )}
      </header>

      <div className="mt-12">
        <EventGrid events={gridEvents} availability={availability} />
      </div>
    </section>
  )
}
