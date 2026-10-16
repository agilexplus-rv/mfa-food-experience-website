import Link from 'next/link'
import { MtText } from '@/components/i18n/MtText'

import type { EventAvailability } from '@/lib/availability-types'
import { formatPrice } from '@/lib/availability-types'
import { formatDay, formatTimeRange } from '@/lib/format-date'

/**
 * EventCard: single upcoming event in a service grid.
 *
 * Per FR-1.5: title, short description, next date, price per person,
 * availability status, a "Read more" link and a booking action.
 *
 * "Read more" navigates to the event's own page (/events/[id]); it is
 * deliberately NOT a dialog (client, 2026-10-17: the modal opened over the
 * card itself, and the event page already carries the photo and the full
 * description).
 *
 * The Events collection has no dedicated `shortDescription` field, so
 * the short description line is derived from location + time range
 * (kept to one line, plain text, never placeholder/lorem). When a
 * `shortDescription` prop is supplied (e.g. from a future field), it
 * takes precedence.
 *
 * Affordance rules (impeccable): card is a real card (white surface,
 * border, rounded), the right affordance for a discrete bookable
 * event. Hover lifts slightly; focus-visible outlines the CTA; the
 * primary CTA is the explicit Terracotta button per the brand spec.
 * A fully-booked card swaps its CTA for the secondary (Lunar Green,
 * outlined) "Join waitlist" action rather than a dead grey button --
 * the event page and /book/[id] both offer the waitlist, so the card
 * should lead there instead of looking disabled.
 */
export interface EventCardProps {
  /** Event id, used to build the booking link (Phase 2). */
  id: string | number
  title: string
  /** ISO date string (dayOnly) e.g. "2026-09-14". */
  date: string
  /** ISO time strings for start/end. */
  startTime: string
  endTime: string
  pricePerPerson: number
  locationRef: string
  availability: EventAvailability
  /** Optional explicit short description (future-proof). */
  shortDescription?: string
  /** Optional href for the card/CTA link. Defaults to the event booking route. */
  href?: string
  /** Event photo shown on the card; a green plate stands in when absent. */
  imageUrl?: string
  imageAlt?: string
}

function AvailabilityBadge({ availability }: { availability: EventAvailability }) {
  const { status, remaining } = availability
  let label = `${remaining} seat${remaining === 1 ? '' : 's'} left`
  let className =
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-center text-xs font-semibold'

  if (status === 'fully_booked') {
    label = 'Fully booked'
    className += ' bg-terracotta/15 text-terracotta-dark'
  } else if (status === 'limited') {
    label = `${remaining} seat${remaining === 1 ? '' : 's'} left`
    className += ' bg-accent-text/20 text-accent-text'
  } else {
    className += ' bg-lunar-green/10 text-lunar-green'
  }
  return <span className={className}>{label}</span>
}

export function EventCard({
  id,
  title,
  date,
  startTime,
  endTime,
  pricePerPerson,
  locationRef,
  availability,
  shortDescription,
  href,
  imageUrl,
  imageAlt,
}: EventCardProps) {
  const timeRange = formatTimeRange(startTime, endTime)
  const fallbackDesc = [locationRef, timeRange].filter(Boolean).join(' · ')
  const desc = shortDescription ?? fallbackDesc
  const linkHref = href ?? `/book/${id}`
  const fullyBooked = availability.status === 'fully_booked'

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:shadow-md">
      {/* Event photo. When neither the event nor its service has one, the
          same blank Lunar Green plate the services cards use (name in Soft
          Beige) stands in -- never a broken/empty image slot. The
          article's own overflow-hidden rounds the photo's top corners. */}
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-lunar-green">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={imageAlt || title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-6 text-center">
            <span className="text-sm font-semibold text-soft-beige">{title}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold tracking-tight text-lunar-green">
            {title}
          </h3>
          <AvailabilityBadge availability={availability} />
        </div>

        <p className="mt-2 line-clamp-2 text-sm text-text-light">
          {desc}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">
              Date
            </dt>
            <dd className="font-semibold text-lunar-green">{formatDay(date)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">
              Per person
            </dt>
            <dd className="font-semibold text-lunar-green">
              {formatPrice(pricePerPerson)} <span className="font-normal text-text-light">inc. VAT</span>
            </dd>
          </div>
        </dl>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Read more, opens the event's own page (not a dialog) */}
        <div className="mt-3">
          <Link
            href={`/events/${id}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent-text transition-colors hover:text-lunar-green focus:outline-2 focus:outline-offset-2 focus:outline-lunar-green"
          >
            <MtText en="Read more" mt="Aqra iktar" />
            <span className="sr-only">about {title}</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          {/* Fully booked is not a dead end: swap the primary booking CTA for
              the secondary (outlined Lunar Green) waitlist action -- /book/[id]
              renders the waitlist form for a full event. py-2 plus the 2px
              border keeps this the same height as the py-2.5 primary. */}
          <Link
            href={linkHref}
            aria-label={fullyBooked ? `Join the waitlist for ${title}` : `Book ${title}`}
            className={[
              'flex w-full items-center justify-center gap-1.5 rounded-lg px-5 text-sm font-bold transition-colors',
              'focus:outline-2 focus:outline-offset-2 focus:outline-lunar-green',
              fullyBooked
                ? 'border-2 border-lunar-green py-2 text-lunar-green hover:bg-lunar-green hover:text-soft-beige'
                : 'bg-terracotta-dark py-2.5 text-white hover:bg-terracotta/85',
            ].join(' ')}
          >
            {fullyBooked ? (
              <MtText en="Join waitlist" mt="Ingħaqad mal-lista tal-istennija" />
            ) : (
              <MtText en="Book Now" mt="Ibbukkja Issa" />
            )}
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </article>
  )
}
