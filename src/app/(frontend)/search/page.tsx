import type { Metadata } from 'next'
import Link from 'next/link'

import { siteSearch, type SearchResultItem } from '@/lib/search/queries'

export const metadata: Metadata = {
  title: 'Search — Malta Food Experience',
  description: 'Search across experiences, news, and testimonials on the Malta Food Experience site.',
}

export const dynamic = 'force-dynamic'

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

function ResultCard({ item }: { item: SearchResultItem }) {
  return (
    <Link
      href={item.href}
      className="block rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:shadow-md focus:outline-2 focus:outline-offset-2 focus:outline-matte-gold"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-matte-gold">
        {item.type === 'service'
          ? 'Experience'
          : item.type === 'news'
            ? 'News'
            : 'Testimonial'}
      </span>
      <h3 className="mt-1 text-lg font-bold text-lunar-green">
        {item.title}
      </h3>
      {item.description && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-text-light">
          {item.description}
        </p>
      )}
    </Link>
  )
}

function ResultSection({
  label,
  items,
}: {
  label: string
  items: SearchResultItem[]
}) {
  if (items.length === 0) return null
  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-lunar-green">
        {label}
        <span className="ml-2 text-sm font-normal text-text-light">
          ({items.length})
        </span>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <ResultCard key={`${item.type}-${i}`} item={item} />
        ))}
      </div>
    </div>
  )
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  if (!query) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-4xl font-black tracking-tight text-lunar-green">
          Search
        </h1>
        <p className="mt-4 text-lg text-text-light">
          Use the search box in the header to find experiences, news, and
          testimonials across the site.
        </p>
      </section>
    )
  }

  const results = await siteSearch(query)
  const total =
    results.services.length +
    results.news.length +
    results.testimonials.length

  if (total === 0) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-4xl font-black tracking-tight text-lunar-green">
          Search
        </h1>
        <p className="mt-4 text-lg text-text-light">
          No results found for{' '}
          <span className="font-semibold text-lunar-green">
            &ldquo;{query}&rdquo;
          </span>
          .
        </p>
        <p className="mt-2 text-sm text-text-light">
          Try a different term, or browse our{' '}
          <Link
            href="/services"
            className="font-semibold text-terracotta hover:text-terracotta/80 focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
          >
            experiences
          </Link>{' '}
          directly.
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-black tracking-tight text-lunar-green">
          Search results
        </h1>
        <p className="mt-2 text-lg text-text-light">
          {total} {total === 1 ? 'result' : 'results'} for{' '}
          <span className="font-semibold text-lunar-green">
            &ldquo;{query}&rdquo;
          </span>
        </p>
      </header>

      <div className="mt-10 flex flex-col gap-10">
        <ResultSection label="Experiences" items={results.services} />
        <ResultSection label="News" items={results.news} />
        <ResultSection label="Testimonials" items={results.testimonials} />
      </div>
    </section>
  )
}
