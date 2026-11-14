import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'

import { listVisibleServices } from '@/lib/services/queries'

/**
 * sitemap.xml
 *
 * Only what a search engine should index: the public marketing and legal
 * pages, every visible service, and events that are still scheduled and in
 * the future. Cancelled, completed and past events are deliberately absent —
 * a stale event page in an index is worse than no page at all.
 *
 * Every dynamic lookup is individually guarded: a database hiccup must cost
 * the dynamic entries, never the whole sitemap.
 */
// Per-request so the base URL comes from the runtime, not the build.
export const dynamic = 'force-dynamic'

const LEGAL_SLUGS = [
  'cancellation-policy',
  'terms-and-conditions',
  'customer-policy',
  'provider-info',
  'privacy-notice',
  'cookie-policy',
  'accessibility-statement',
  'data-protection-policy',
] as const

const STATIC_PAGES: Array<{ path: string; priority: number }> = [
  { path: '/', priority: 1 },
  { path: '/about', priority: 0.8 },
  { path: '/services', priority: 0.9 },
  { path: '/news', priority: 0.7 },
  { path: '/testimonials', priority: 0.6 },
  { path: '/contact', priority: 0.6 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'https://foodexperience.mt').replace(/\/$/, '')
  const now = new Date()

  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    url: `${base}${page.path}`,
    lastModified: now,
    changeFrequency: page.path === '/' ? 'weekly' : 'monthly',
    priority: page.priority,
  }))

  for (const slug of LEGAL_SLUGS) {
    entries.push({
      url: `${base}/legal/${slug}`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    })
  }

  try {
    const services = await listVisibleServices()
    for (const service of services) {
      entries.push({
        url: `${base}/services/${service.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    }
  } catch (error) {
    console.error('[sitemap] services unavailable:', error)
  }

  try {
    const payload = await getPayload({ config })
    const events = await payload.find({
      collection: 'events',
      where: {
        and: [
          { status: { equals: 'scheduled' } },
          { date: { greater_than_equal: new Date().toISOString() } },
        ],
      },
      sort: 'date',
      limit: 500,
      depth: 0,
    })
    for (const doc of events.docs as Array<{ id: string | number; date?: string | null }>) {
      entries.push({
        url: `${base}/events/${doc.id}`,
        lastModified: doc.date ? new Date(doc.date) : now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }
  } catch (error) {
    console.error('[sitemap] events unavailable:', error)
  }

  return entries
}
