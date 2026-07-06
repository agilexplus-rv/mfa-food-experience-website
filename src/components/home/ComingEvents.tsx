import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { formatPrice, getAvailabilityForEvents } from '@/lib/availability'
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
                className="flex flex-col rounded-lg border border-matte-gold/20 bg-white p-6 shadow-sm"
              >
                <h3 className="font-bold text-xl text-lunar-green">{event.title}</h3>
                <p className="mt-1 text-sm text-lunar-green/60">
                  {event.date} · {event.startTime}
                </p>
                <p className="mt-2 font-semibold text-terracotta text-lg">
                  {formatPrice(event.pricePerPerson ?? 0)}
                  <span className="text-sm font-regular text-lunar-green/60"> / person</span>
                </p>
                <p className="mt-2 text-sm font-semibold text-lunar-green/80">
                  {fullyBooked ? (
                    <span className="text-terracotta">Fully booked</span>
                  ) : (
                    <span>{remaining} seats left</span>
                  )}
                </p>
                <Link
                  href="/services"
                  className="mt-4 inline-flex items-center justify-center rounded-lg bg-terracotta px-4 py-2 text-sm font-bold text-soft-beige transition-colors hover:bg-terracotta/85"
                >
                  Book
                </Link>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
