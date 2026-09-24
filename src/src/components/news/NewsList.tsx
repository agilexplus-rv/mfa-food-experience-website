'use client'

import { useState } from 'react'

import { NewsCard } from './NewsCard'

export interface NewsItem {
  id: string | number
  title: string
  date: string
  slug: string
  image?: { url?: string; alt?: string } | string | null
  excerpt?: string
}

export interface NewsListProps {
  items: NewsItem[]
  /** Number of items to show initially. */
  initialPageSize?: number
  /** Number of items to reveal on each "Show more" click. */
  pageSize?: number
}

/**
 * NewsList — client-side "Show more" wrapper for the News listing.
 *
 * Renders the first `initialPageSize` items, then reveals
 * `pageSize` more on each button click until all are shown.
 */
export function NewsList({
  items,
  initialPageSize = 6,
  pageSize = 6,
}: NewsListProps) {
  const [visibleCount, setVisibleCount] = useState(initialPageSize)
  const visible = items.slice(0, visibleCount)
  const hasMore = visibleCount < items.length

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <NewsCard
            key={String(item.id)}
            id={item.id}
            title={item.title}
            date={item.date}
            slug={item.slug}
            image={item.image}
            excerpt={item.excerpt}
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
