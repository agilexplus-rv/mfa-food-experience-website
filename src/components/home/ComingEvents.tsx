import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { MtText } from '@/components/i18n/MtText'
import { formatPrice, getAvailabilityForEvents } from '@/lib/availability'
import { formatDay, formatTimeRange } from '@/lib/format-date'
import { getMediaUrl } from '@/lib/payload'
import { richTextToHtml } from '@/lib/richtext'
import { ReadMoreButton } from '@/components/services/ReadMoreButton'
import type { EventDoc } from '@/lib/availability-types'

/**
 * Upcoming Experiences section (FR-7.1).
 * Shows upcoming experiences across VISIBLE services, with availability,
 * a "Read more" dialog (experience picture + description) and Book Now.
 */

/** The event's service relation is an id or (at depth >= 1) the populated doc. */
function serviceIdOf(ev: EventDoc): string {
  const svc = (ev as unknown as { service?: string | number | { id?: string | number } | null }).service
  if (svc && typeof svc === 'object') return svc.id != null ? String(svc.id) : ''
  return svc != null ? String(svc) : ''
}
export async function ComingEvents() {
  const payload = await getPayload({ config })
  const now = new Date().toISOString()

  // Upcoming scheduled events, ordered by date. Fetch a few extra so
  // events of hidden services can be dropped and still fill 6 cards.
  const { docs } = await payload.find({
    collection: 'events',
    where: {
      and: [
        { status: { equals: 'scheduled' } },
        { date: { greater_than_equal: now.slice(0, 10) } },
      ],
    },
    sort: 'date',
    limit: 18,
    depth: 0,
  })

  const candidates = docs as unknown as EventDoc[]

  // Resolve each event's service (image, description, visibility). This
  // previously did String(event.service) on a populated object, producing
  // "[object Object]", so every lookup failed and cards had no image or
  // read-more at all.
  const serviceInfo = new Map<string, { visible: boolean; url?: string; alt?: string; descriptionHtml?: string }>()
  await Promise.all(
    [...new Set(candidates.map(serviceIdOf).filter(Boolean))].map(async (sid) => {
      try {
        const svc = await payload.findByID({ collection: 'services', id: sid, depth: 1, overrideAccess: true })
        const s = svc as unknown as { visible?: boolean; imagery?: unknown; description?: unknown }
        serviceInfo.set(sid, {
          visible: Boolean(s.visible),
          url: getMediaUrl(s.imagery as Parameters<typeof getMediaUrl>[0]) ?? undefined,
          alt: (typeof s.imagery === 'object' && (s.imagery as Record<string, unknown>)?.alt as string) || undefined,
          descriptionHtml: richTextToHtml(s.description) || undefined,
        })
      } catch {
        serviceInfo.set(sid, { visible: false })
      }
    }),
  )

  // FR-1.2: events of hidden services are not shown publicly.
  const events = candidates.filter((ev) => serviceInfo.get(serviceIdOf(ev))?.visible).slice(0, 6)

  const availability = await getAvailabilityForEvents(
    events.map((e) => ({
      id: e.id,
      capacity: e.capacity ?? 0,
      fullyBookedOverride: e.fullyBookedOverride,
    })),
  )

  // Hide the section entirely when there are no upcoming events
  // (consistent with LatestNews — no "no events" message shown).
  if (events.length === 0) return null

  return (
    <section className="bg-soft-beige px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-black text-3xl tracking-tight text-lunar-green sm:text-4xl">
          Upcoming Experiences
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const avail = availability.get(String(event.id))
            const remaining = avail?.remaining ?? event.capacity ?? 0
            const fullyBooked = avail?.status === 'fully_booked'
            const info = serviceInfo.get(serviceIdOf(event))
            const bookHref = `/book/${event.id}`
            return (
              <article
                key={String(event.id)}
                className="flex h-full flex-col overflow-hidden rounded-lg border border-matte-gold/20 bg-white shadow-sm"
              >
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-bold text-xl text-lunar-green">{event.title}</h3>
                  <p className="mt-1 text-sm text-text-light">
                    {formatDay(event.date)} · {formatTimeRange(event.startTime, event.endTime)}
                  </p>
                  <p className="mt-2 font-semibold text-terracotta-dark text-lg">
                    {formatPrice(event.pricePerPerson ?? 0)}
                    <span className="text-sm font-regular text-text-light"> / person</span>
                  </p>

                  {/* Spacer pushes the action row to the bottom for equal-height alignment */}
                  <div className="flex-1" />

                  {/* Read more — dialog with the experience picture + description */}
                  <div className="mt-2">
                    <ReadMoreButton
                      content={{
                        title: event.title,
                        subtitle: `${formatDay(event.date)} · ${formatTimeRange(event.startTime, event.endTime)} · ${formatPrice(event.pricePerPerson ?? 0)} per person`,
                        descriptionHtml: info?.descriptionHtml,
                        imageUrl: info?.url,
                        imageAlt: info?.alt,
                        bookHref: fullyBooked ? undefined : bookHref,
                      }}
                    />
                  </div>

                  {/* Compact action row: seats pill + smaller Book button */}
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-matte-gold/20 pt-4">
                    {fullyBooked ? (
                      <span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-terracotta/15 px-3 py-1 text-xs font-semibold text-terracotta-dark">
                        Fully booked
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-accent-text/20 px-3 py-1 text-xs font-semibold text-accent-text">
                        {remaining} {remaining === 1 ? 'seat' : 'seats'} left
                      </span>
                    )}
                    <Link
                      href={fullyBooked ? '/services' : bookHref}
                      aria-label={fullyBooked ? `${event.title} — fully booked` : `Book ${event.title}`}
                      aria-disabled={fullyBooked}
                      tabIndex={fullyBooked ? -1 : 0}
                      className={[
                        'inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-1.5 text-sm font-bold transition-colors',
                        'focus:outline-2 focus:outline-offset-2 focus:outline-terracotta',
                        fullyBooked
                          ? 'cursor-not-allowed bg-lunar-green/10 text-lunar-green/50'
                          : 'bg-terracotta-dark text-white hover:bg-terracotta/85',
                      ].join(' ')}
                    >
                      {fullyBooked ? <MtText en="Full" mt="Mimli" /> : <MtText en="Book Now" mt="Ibbukkja Issa" />}
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
