import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { formatPrice, getAvailabilityForEvents } from '@/lib/availability'
import { formatDay, formatTimeRange } from '@/lib/format-date'
import type { EventDoc } from '@/lib/availability-types'

/**
 * Coming Events section (FR-7.1).
 * Shows upcoming events across VISIBLE services, with availability + booking links.
 */
export async function ComingEvents() {
  const payload = await getPayload({ config })
  const now = new Date().toISOString()

  // Upcoming events for visible services, ordered by date, limit 6.
  const { docs } = await payload.find({
    collection: 'events',
    where: {
      and: [
        { date: { greater_than_equal: now.slice(0, 10) } },
      ],
    },
    sort: 'date',
    limit: 6,
    // Public read access on events already filters to visible services via
    // the collection's access control; overrideAccess false (default) honours that.
  })

  const events = docs as unknown as EventDoc[]
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
          Coming Events
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const avail = availability.get(String(event.id))
            const remaining = avail?.remaining ?? event.capacity ?? 0
            const fullyBooked = avail?.status === 'fully_booked'
            return (
              <article
                key={String(event.id)}
                className="flex h-full flex-col rounded-lg border border-matte-gold/20 bg-white p-6 shadow-sm"
              >
                <h3 className="font-bold text-xl text-lunar-green">{event.title}</h3>
                <p className="mt-1 text-sm text-lunar-green/60">
                  {formatDay(event.date)} · {formatTimeRange(event.startTime, event.endTime)}
                </p>
                <p className="mt-2 font-semibold text-terracotta text-lg">
                  {formatPrice(event.pricePerPerson ?? 0)}
                  <span className="text-sm font-regular text-lunar-green/60"> / person</span>
                </p>

                {/* Spacer pushes the action row to the bottom for equal-height alignment */}
                <div className="flex-1" />

                {/* Compact action row: seats pill + smaller Book button */}
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-matte-gold/20 pt-4">
                  {fullyBooked ? (
                    <span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-terracotta/15 px-3 py-1 text-xs font-semibold text-terracotta">
                      Fully booked
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-matte-gold/20 px-3 py-1 text-xs font-semibold text-matte-gold">
                      {remaining} {remaining === 1 ? 'seat' : 'seats'} left
                    </span>
                  )}
                  <Link
                    href={fullyBooked ? '/services' : `/book/${event.id}`}
                    aria-label={fullyBooked ? `${event.title} — fully booked` : `Book ${event.title}`}
                    aria-disabled={fullyBooked}
                    tabIndex={fullyBooked ? -1 : 0}
                    className={[
                      'inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-1.5 text-sm font-bold transition-colors',
                      'focus:outline-2 focus:outline-offset-2 focus:outline-terracotta',
                      fullyBooked
                        ? 'cursor-not-allowed bg-lunar-green/10 text-lunar-green/50'
                        : 'bg-terracotta text-soft-beige hover:bg-terracotta/85',
                    ].join(' ')}
                  >
                    {fullyBooked ? 'Full' : 'Book'}
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
