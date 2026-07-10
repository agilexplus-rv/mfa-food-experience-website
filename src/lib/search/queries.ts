import { getPayload } from 'payload'
import config from '@payload-config'
import { getExcerpt } from '@/lib/payload'

/**
 * Site-wide search queries.
 *
 * Fetches Services, Events, News, and Testimonials via the Payload Local
 * API and performs free-text matching against their human-readable fields.
 * The datasets are small (services <20, events in the low hundreds, news
 * capped, testimonials capped at 50) so we fetch in bulk and match
 * server-side rather than building a dedicated search API/index.
 *
 * The architecture is fully type-agnostic: it queries the generic
 * `services` and `events` collections with no hardcoded service names or
 * slugs. Any new Service (or its Events) added in Payload is automatically
 * searchable the moment it becomes visible/scheduled — zero code changes
 * required.
 */

export interface SearchResultItem {
  title: string
  description?: string
  href: string
  type: 'service' | 'event' | 'news' | 'testimonial'
}

export interface SearchResults {
  services: SearchResultItem[]
  events: SearchResultItem[]
  news: SearchResultItem[]
  testimonials: SearchResultItem[]
  query: string
}

/** Case-insensitive substring match on one or more haystacks. */
function matches(query: string, ...haystacks: (string | undefined)[]): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return false
  return haystacks.some((h) => h && h.toLowerCase().includes(q))
}

/**
 * Run a free-text search across all content types.
 * Returns grouped results so the results page can render sections.
 */
export async function siteSearch(query: string): Promise<SearchResults> {
  const payload = await getPayload({ config })

  // Fetch services (visible only — public read access enforces this)
  const servicesRes = await payload.find({
    collection: 'services',
    where: { visible: { equals: true } },
    sort: 'order',
    limit: 100,
    depth: 1,
  })

  // Fetch scheduled events.
  // depth: 1 populates the `service` relationship so we can read the
  // parent Service's name without a second query per event.
  // Public read access already filters to status: 'scheduled' for
  // unauthenticated requests (see Events.ts access.read), but we add
  // the explicit filter so the query is self-documenting and also works
  // correctly if the local API call ever runs with overrideAccess.
  const eventsRes = await payload.find({
    collection: 'events',
    where: { status: { equals: 'scheduled' } },
    sort: 'date',
    limit: 200,
    depth: 1,
  })

  // Fetch news items (published only)
  const newsRes = await payload.find({
    collection: 'news_items',
    where: { published: { equals: true } },
    sort: '-date',
    limit: 50,
  })

  // Fetch approved testimonials
  const testimonialsRes = await payload.find({
    collection: 'testimonials',
    where: { approved: { equals: true } },
    sort: '-createdAt',
    limit: 50,
  })

  const q = query.trim()

  const services: SearchResultItem[] = (servicesRes.docs as unknown as {
    name: string
    slug: string
    description?: unknown
  }[])
    .filter((s) => matches(q, s.name, getExcerpt(s.description)))
    .map((s) => ({
      title: s.name,
      description: getExcerpt(s.description, 200) || undefined,
      href: `/services/${s.slug}`,
      type: 'service' as const,
    }))

  const events: SearchResultItem[] = (eventsRes.docs as unknown as {
    id: string | number
    title: string
    locationRef: string
    date: string
    service?: { name?: string } | string | number | null
  }[])
    .filter((e) => {
      // Match against the event's own title, its location, and the parent
      // Service's name (e.g. searching "Classes" surfaces individual class
      // events too, not just the Classes service page itself).
      const serviceName =
        e.service && typeof e.service === 'object' ? e.service.name : undefined
      return matches(q, e.title, e.locationRef, serviceName)
    })
    .map((e) => {
      const serviceName =
        e.service && typeof e.service === 'object' ? e.service.name : undefined
      const descParts = [serviceName, e.locationRef].filter(Boolean)
      return {
        title: e.title,
        description: descParts.length > 0 ? descParts.join(' · ') : undefined,
        href: `/book/${e.id}`,
        type: 'event' as const,
      }
    })

  const news: SearchResultItem[] = (newsRes.docs as unknown as {
    title: string
    slug: string
    body?: unknown
  }[])
    .filter((n) => matches(q, n.title, getExcerpt(n.body)))
    .map((n) => ({
      title: n.title,
      description: getExcerpt(n.body, 200) || undefined,
      href: `/news/${n.slug}`,
      type: 'news' as const,
    }))

  const testimonials: SearchResultItem[] = (testimonialsRes.docs as unknown as {
    id: string
    name: string
    text: string
  }[])
    .filter((t) => matches(q, t.name, t.text))
    .map((t) => ({
      title: t.name,
      description: t.text,
      href: '/testimonials',
      type: 'testimonial' as const,
    }))

  return { services, events, news, testimonials, query }
}
