'use client'

import { useState } from 'react'

import { TestimonialCard } from './TestimonialCard'

export interface TestimonialItem {
  id: string
  name: string
  text: string
  eventName?: string
}

export interface TestimonialListProps {
  items: TestimonialItem[]
  initialPageSize?: number
  pageSize?: number
}

/**
 * TestimonialList — client-side "Show more" wrapper for testimonials.
 *
 * Renders the first `initialPageSize` items, then reveals
 * `pageSize` more on each button click until all are shown.
 */
export function TestimonialList({
  items,
  initialPageSize = 9,
  pageSize = 9,
}: TestimonialListProps) {
  const [visibleCount, setVisibleCount] = useState(initialPageSize)
  const visible = items.slice(0, visibleCount)
  const hasMore = visibleCount < items.length

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((t) => (
          <TestimonialCard
            key={t.id}
            name={t.name}
            text={t.text}
            eventName={t.eventName}
          />
        ))}
      </div>
      {hasMore && (
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + pageSize)}
            className="inline-flex items-center rounded-lg border border-lunar-green/30 bg-surface px-6 py-3 text-sm font-bold text-lunar-green transition-colors hover:bg-lunar-green/5 focus:outline-2 focus:outline-offset-2 focus:outline-matte-gold"
          >
            Show more
            <span aria-hidden="true" className="ml-1.5">&darr;</span>
          </button>
        </div>
      )}
    </div>
  )
}
