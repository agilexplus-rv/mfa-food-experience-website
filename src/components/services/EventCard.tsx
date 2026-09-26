import Link from 'next/link'
import { MtText } from '@/components/i18n/MtText'

import type { EventAvailability } from '@/lib/availability-types'
import { formatPrice } from '@/lib/availability-types'
import { formatDay, formatTimeRange } from '@/lib/format-date'

/**
 * EventCard — single upcoming event in a service grid.
 *
 * Per FR-1.5: title, short description, next date, price per person,
 * availability status, and a "Learn more / Book" action.
 *
 * The Events collection has no dedicated `shortDescription` field, so
 * the short description line is derived from location + time range
 * (kept to one line, plain text — never placeholder/lorem). When a
 * `shortDescription` prop is supplied (e.g. from a future field), it
 * takes precedence.
 *
 * Affordance rules (impeccable): card is a real card (white surface,
 * border, rounded) — the right affordance for a discrete bookable
 * event. Hover lifts slightly; focus-visible outlines the CTA; the
 * primary CTA is the explicit Terracotta button per the brand spec.
 * Fully-booked cards disable the CTA and dim it (no false affordance).
 */
export interface EventCardProps {
  /** Event id — used to build the booking link (Phase 2). */
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
  /** Service image URL for the card media area. */
  imageUrl?: string
  /** Alt text for the service image. */
  imageAlt?: string
  /** Link to the service detail page for "Read more". */
  serviceHref?: string
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
  serviceHref,
}: EventCardProps) {
  const timeRange = formatTimeRange(startTime, endTime)
  const fallbackDesc = [locationRef, timeRange].filter(Boolean).join(' · ')
  const desc = shortDescription ?? fallbackDesc
  const linkHref = href ?? `/book/${id}`
  const fullyBooked = availability.status === 'fully_booked'

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:shadow-md">
      {/* Service image — shown when available (read-more preview) */}
      {imageUrl && (
        <div className="aspect-[16/9] w-full overflow-hidden bg-lunar-green/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={imageAlt || title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}

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
              {formatPrice(pricePerPerson)}
            </dd>
          </div>
        </dl>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Read more link — goes to service detail page */}
        {serviceHref && (
          <div className="mt-3">
            <Link
              href={serviceHref}
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent-text hover:text-lunar-green transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-lunar-green"
            >
              <MtText en="Read more" mt="Aqra iktar" />
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border">
          <Link
            href={linkHref}
            aria-label={fullyBooked ? `${title} — fully booked` : `Book ${title}`}
            aria-disabled={fullyBooked}
            tabIndex={fullyBooked ? -1 : 0}
            className={[
              'flex w-full items-center justify-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-bold transition-colors',
              'focus:outline-2 focus:outline-offset-2 focus:outline-terracotta',
              fullyBooked
                ? 'cursor-not-allowed bg-lunar-green/10 text-lunar-green/50'
                : 'bg-terracotta-dark text-white hover:bg-terracotta/85',
            ].join(' ')}
          >
            {fullyBooked ? <MtText en="Fully booked" mt="Kollox mibbukkjat" /> : <MtText en="Book" mt="Ibbukkja" />}
            {!fullyBooked && <span aria-hidden="true">&rarr;</span>}
          </Link>
        </div>
      </div>
    </article>
  )
}
