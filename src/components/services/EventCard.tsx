import Link from 'next/link'

import type { EventAvailability } from '@/lib/availability-types'
import { formatPrice } from '@/lib/availability-types'

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
}

function formatDay(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateIso
  return d.toLocaleDateString('en-MT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTimeRange(startIso: string, endIso: string): string {
  const s = new Date(startIso)
  const e = new Date(endIso)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return ''
  const fmt = new Intl.DateTimeFormat('en-MT', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  })
  return `${fmt.format(s)} – ${fmt.format(e)}`
}

function AvailabilityBadge({ availability }: { availability: EventAvailability }) {
  const { status, remaining } = availability
  let label = `${remaining} seat${remaining === 1 ? '' : 's'} left`
  let className =
    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold'

  if (status === 'fully_booked') {
    label = 'Fully booked'
    className += ' bg-terracotta/15 text-terracotta'
  } else if (status === 'limited') {
    label = `${remaining} seat${remaining === 1 ? '' : 's'} left`
    className += ' bg-matte-gold/20 text-matte-gold'
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
}: EventCardProps) {
  const timeRange = formatTimeRange(startTime, endTime)
  const fallbackDesc = [locationRef, timeRange].filter(Boolean).join(' · ')
  const desc = shortDescription ?? fallbackDesc
  const linkHref = href ?? `/book/${id}`
  const fullyBooked = availability.status === 'fully_booked'

  return (
    <article className="group relative flex flex-col rounded-xl border border-border bg-surface p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:shadow-md">
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
          <dt className="text-xs font-semibold uppercase tracking-wide text-lunar-green/50">
            Next date
          </dt>
          <dd className="font-semibold text-lunar-green">{formatDay(date)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-lunar-green/50">
            Per person
          </dt>
          <dd className="font-semibold text-lunar-green">
            {formatPrice(pricePerPerson)}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-border">
        <span className="text-xs text-text-light" aria-hidden="true">
          {timeRange}
        </span>
        <Link
          href={linkHref}
          aria-label={fullyBooked ? `${title} — fully booked` : `Book ${title}`}
          aria-disabled={fullyBooked}
          tabIndex={fullyBooked ? -1 : 0}
          className={[
            'inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-bold transition-colors',
            'focus:outline-2 focus:outline-offset-2 focus:outline-terracotta',
            fullyBooked
              ? 'cursor-not-allowed bg-lunar-green/10 text-lunar-green/50'
              : 'bg-terracotta text-soft-beige hover:bg-terracotta/85',
          ].join(' ')}
        >
          {fullyBooked ? 'Fully booked' : 'Book'}
          {!fullyBooked && <span aria-hidden="true">&rarr;</span>}
        </Link>
      </div>
    </article>
  )
}
