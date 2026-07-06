'use client'

import { useMemo, useState } from 'react'

import { EventCard } from './EventCard'
import { MonthFilter, type MonthOption } from './MonthFilter'
import type { EventAvailability } from '@/lib/availability'

/**
 * EventGrid — client wrapper that holds the active month filter and
 * renders MonthFilter + the filtered list of EventCards.
 *
 * Receives server-rendered event data + a Map of availability keyed by
 * String(eventId). Filters client-side (cheap for typical event counts)
 * to avoid re-fetching on every month change.
 *
 * "No events" empty state is brand-styled (not a bare <p>).
 */
export interface GridEvent {
  id: string | number
  title: string
  date: string
  startTime: string
  endTime: string
  pricePerPerson: number
  locationRef: string
  shortDescription?: string
}

export interface EventGridProps {
  events: GridEvent[]
  availability: Map<string, EventAvailability>
  /** Optional href builder for event cards. */
  eventHref?: (id: string | number) => string
}

const MONTH_FMT = new Intl.DateTimeFormat('en-MT', {
  month: 'short',
  year: 'numeric',
})

function monthKey(iso: string): string {
  // "YYYY-MM" from an ISO date string.
  return iso.slice(0, 7)
}

export function EventGrid({ events, availability, eventHref }: EventGridProps) {
  const sorted = useMemo(() => {
    return [...events].sort((a, b) => a.date.localeCompare(b.date))
  }, [events])

  const options: MonthOption[] = useMemo(() => {
    const seen = new Map<string, string>()
    for (const e of sorted) {
      const k = monthKey(e.date)
      if (!seen.has(k)) {
        const d = new Date(e.date + 'T00:00:00')
        const label = Number.isNaN(d.getTime()) ? k : MONTH_FMT.format(d)
        seen.set(k, label)
      }
    }
    const list: MonthOption[] = [
      { value: 'all', label: 'All months' },
      ...[...seen.entries()].map(([value, label]) => ({ value, label })),
    ]
    return list
  }, [sorted])

  const [active, setActive] = useState<string>('all')

  const filtered = useMemo(() => {
    if (active === 'all') return sorted
    return sorted.filter((e) => monthKey(e.date) === active)
  }, [sorted, active])

  return (
    <div>
      {options.length > 1 && (
        <div className="mb-8">
          <MonthFilter options={options} value={active} onChange={setActive} />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center">
          <p className="text-lg font-semibold text-lunar-green">
            No upcoming events
          </p>
          <p className="mt-2 text-sm text-text-light">
            New dates are added regularly — please check back soon.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => {
            const av = availability.get(String(e.id))
            if (!av) return null
            return (
              <EventCard
                key={e.id}
                id={e.id}
                title={e.title}
                date={e.date}
                startTime={e.startTime}
                endTime={e.endTime}
                pricePerPerson={e.pricePerPerson}
                locationRef={e.locationRef}
                availability={av}
                shortDescription={e.shortDescription}
                href={eventHref?.(e.id)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
