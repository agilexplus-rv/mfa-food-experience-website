import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { getAvailabilityForEvents, type EventDoc, type EventAvailability } from '@/lib/availability'

/**
 * Server-side service/event queries for the public pages.
 *
 * The Services collection's public read access already enforces
 * `visible: { equals: true }` for anonymous requests (see
 * src/payload/collections/Services.ts). For the "hidden service shows
 * a not-available state" requirement (FR-1.3), we explicitly query
 * with `overrideAccess: true` so we can fetch a hidden service by slug,
 * inspect its `visible` flag, and render the correct state.
 */

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

export interface ServiceSummary {
  id: string | number
  name: string
  slug: string
  visible: boolean
  order: number
  imageryUrl?: string
}

export interface ServiceDetail extends ServiceSummary {}

export interface ServiceEvents {
  events: EventDoc[]
  /** Availability map keyed by String(eventId). */
  availability: Map<string, EventAvailability>
}

/** List all visible services for the /services index. */
export async function listVisibleServices(): Promise<ServiceSummary[]> {
  const p = await payload()
  const res = await p.find({
    collection: 'services',
    where: { visible: { equals: true } },
    sort: 'order',
    limit: 100,
    // Anonymous request → read access enforces visible=true; no override needed.
  })
  return res.docs.map((d: unknown) => {
    const s = d as ServiceSummary
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      visible: true,
      order: s.order ?? 0,
      imageryUrl: s.imageryUrl,
    }
  })
}

/**
 * Fetch a service by slug — bypasses the public read filter so hidden
 * services resolve (we then render the not-available state in the page).
 * Returns `null` if no service exists at this slug at all (404).
 */
export async function getServiceBySlug(
  slug: string,
): Promise<ServiceDetail | null> {
  const p = await payload()
  let res
  try {
    res = await p.find({
      collection: 'services',
      where: { slug: { equals: slug } },
      limit: 1,
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[services/queries] Failed to fetch service by slug:', err)
    return null
  }
  if (res.docs.length === 0) return null
  const s = res.docs[0] as ServiceDetail
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    visible: Boolean(s.visible),
    order: s.order ?? 0,
    imageryUrl: s.imageryUrl,
  }
}

/**
 * Fetch upcoming scheduled events for a service, plus their availability.
 * Only future dates (>= today) are returned, sorted ascending.
 */
export async function getServiceEvents(serviceId: string | number): Promise<ServiceEvents> {
  const p = await payload()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const todayIso = startOfToday.toISOString().slice(0, 10)

  const res = await p.find({
    collection: 'events',
    where: {
      and: [
        { service: { equals: serviceId } },
        { status: { equals: 'scheduled' } },
        { date: { greater_than_equal: todayIso } },
      ],
    },
    sort: 'date',
    limit: 100,
    // Public read access enforces status=scheduled; events for hidden
    // services would still be individually scheduled. We override here
    // so the page can decide based on the service's visible flag — but
    // only ever renders the grid when visible=true.
    overrideAccess: true,
  })

  const events = res.docs as unknown as EventDoc[]
  const availability = await getAvailabilityForEvents(
    events.map((e) => ({
      id: e.id,
      capacity: e.capacity,
      fullyBookedOverride: e.fullyBookedOverride,
    })),
  )
  return { events, availability }
}
