import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { MtText } from '@/components/i18n/MtText'
import { formatPrice, getAvailabilityForEvents } from '@/lib/availability'
import { formatDay, formatTimeRange } from '@/lib/format-date'
import { getMediaUrl } from '@/lib/payload'
import type { EventDoc } from '@/lib/availability-types'
import type { MediaRelation } from '@/payload-types'

/**
 * Upcoming Experiences section (FR-7.1).
 * Shows upcoming experiences across VISIBLE services, with availability,
 * the event's photo, a "Read more" link (to the event's own page) and
 * Book Now.
 */

/** The event's service relation is an id or (at depth >= 1) the populated doc. */
function serviceIdOf(ev: EventDoc): string {
  const svc = (ev as unknown as { service?: string | number | { id?: string | number } | null }).service
  if (svc && typeof svc === 'object') return svc.id != null ? String(svc.id) : ''
  return svc != null ? String(svc) : ''
}

/**
 * Card photo: the event's own image, else its service's -- the same
 * fallback the event page and the "Read more" dialog already use. Only
 * when neither exists does the green plate stand in (see the render).
 */
function cardImage(ev: EventDoc, serviceImagery: MediaRelation): { url?: string; alt: string } {
  const img = (ev.imagery ?? serviceImagery) ?? null
  return {
    url: getMediaUrl(img) ?? undefined,
    alt: (typeof img === 'object' && img?.alt) || ev.title,
  }
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
    // depth 1 populates each event's own `imagery` upload for the card photo.
    depth: 1,
  })

  const candidates = docs as unknown as EventDoc[]

  // Resolve each event's service visibility (and imagery, used as the
  // card photo's fallback). This previously did
  // String(event.service) on a populated object, producing "[object
  // Object]", so every lookup failed and cards were dropped entirely.
  const serviceInfo = new Map<string, { visible: boolean; imagery?: MediaRelation }>()
  await Promise.all(
    [...new Set(candidates.map(serviceIdOf).filter(Boolean))].map(async (sid) => {
      try {
        const svc = await payload.findByID({ collection: 'services', id: sid, depth: 1, overrideAccess: true })
        const s = svc as unknown as { visible?: boolean; imagery?: MediaRelation }
        serviceInfo.set(sid, { visible: Boolean(s.visible), imagery: s.imagery })
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
  // (consistent with LatestNews, no "no events" message shown).
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
            const bookHref = `/book/${event.id}`
            const image = cardImage(event, serviceInfo.get(serviceIdOf(event))?.imagery)
            return (
              <article
                key={String(event.id)}
                className="flex h-full flex-col overflow-hidden rounded-lg border border-matte-gold/20 bg-white shadow-sm"
              >
                {/* Event photo, else its service's; a blank Lunar Green
                    plate (as on the services cards) when neither exists. */}
                <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-lunar-green">
                  {image.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image.url} alt={image.alt} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-6 text-center">
                      <span className="text-sm font-semibold text-soft-beige">{event.title}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-bold text-xl text-lunar-green">{event.title}</h3>
                  <p className="mt-1 text-sm text-text-light">
                    {formatDay(event.date)} · {formatTimeRange(event.startTime, event.endTime)}
                  </p>
                  <p className="mt-2 font-semibold text-terracotta-dark text-lg">
                    {formatPrice(event.pricePerPerson ?? 0)}
                    <span className="text-sm font-regular text-text-light"> / person, inc. VAT</span>
                  </p>

                  {/* Spacer pushes the action row to the bottom for equal-height alignment */}
                  <div className="flex-1" />

                  {/* Read more, links to the event's own page */}
                  <div className="mt-2">
                    <Link
                      href={`/events/${event.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-accent-text transition-colors hover:text-lunar-green focus:outline-2 focus:outline-offset-2 focus:outline-lunar-green"
                    >
                      <MtText en="Read more" mt="Aqra iktar" />
                      <span className="sr-only">about {event.title}</span>
                      <span aria-hidden="true">&rarr;</span>
                    </Link>
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
                    {/* Fully booked is not a dead end: the CTA becomes the
                        secondary (outlined Lunar Green) waitlist action, and
                        /book/[id] renders the waitlist form for a full event.
                        py-1 plus the 2px border matches the py-1.5 primary. */}
                    <Link
                      href={bookHref}
                      aria-label={fullyBooked ? `Join the waitlist for ${event.title}` : `Book ${event.title}`}
                      className={[
                        'inline-flex shrink-0 items-center justify-center rounded-lg px-4 text-sm font-bold transition-colors',
                        'focus:outline-2 focus:outline-offset-2 focus:outline-lunar-green',
                        fullyBooked
                          ? 'border-2 border-lunar-green py-1 text-lunar-green hover:bg-lunar-green hover:text-soft-beige'
                          : 'bg-terracotta-dark py-1.5 text-white hover:bg-terracotta-dark/85',
                      ].join(' ')}
                    >
                      {fullyBooked ? (
                        <MtText en="Join waitlist" mt="Ingħaqad mal-lista tal-istennija" />
                      ) : (
                        <MtText en="Book Now" mt="Ibbukkja Issa" />
                      )}
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
