import type { Metadata } from 'next'

import config from '@payload-config'
import { getPayload } from 'payload'

import { Logo } from '@/components/brand/Logo'
import { TestimonialForm } from '@/components/testimonials/TestimonialForm'
import { TestimonialList } from '@/components/testimonials/TestimonialList'

export const metadata: Metadata = {
  title: 'Testimonials — Malta Food Experience',
  description:
    'Read what past participants say about Malta Food Experience events and classes. Share your own testimonial.',
}

interface TestimonialDoc {
  id: string
  name: string
  text: string
  event?:
    | { id: string; title: string }
    | string
    | null
}

/**
 * Testimonials page (FR-8 / FR-11.2).
 *
 * Server component: fetches approved testimonials via the Payload Local API,
 * renders them in a responsive grid alongside a public submission form and the
 * Omnibus verification statement. The grid uses client-side "Show more"
 * pagination (9 items per page) to avoid dumping 50 cards at once.
 */
export default async function TestimonialsPage() {
  let testimonials: TestimonialDoc[] = []
  let events: { id: string; title: string }[] = []

  try {
    const payload = await getPayload({ config })

    const result = await payload.find({
      collection: 'testimonials',
      where: { approved: { equals: true } },
      sort: '-createdAt',
      limit: 50,
    })
    testimonials = result.docs as unknown as TestimonialDoc[]

    const eventsResult = await payload.find({
      collection: 'events',
      where: { visible: { equals: true } },
      sort: 'date',
      limit: 200,
    })
    events = (eventsResult.docs as unknown as { id: string; title: string }[]).map(
      (e) => ({ id: e.id, title: e.title }),
    )
  } catch {
    // Degrade gracefully: empty lists render the form still functional
  }

  const listItems = testimonials.map((t) => ({
    id: t.id,
    name: t.name,
    text: t.text,
    eventName:
      typeof t.event === 'object' && t.event !== null
        ? t.event.title
        : undefined,
  }))

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <header className="mx-auto max-w-2xl text-center">
        <Logo variant="primary" size="sm" className="!p-0 mx-auto" />
        <h1 className="mt-4 text-4xl font-black tracking-[-0.02em] text-lunar-green sm:text-5xl">
          Testimonials
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-text-light">
          Hear from past participants about their Malta Food Experience.
        </p>
      </header>

      {/* Omnibus statement (FR-11.2) */}
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm italic text-matte-gold">
        Testimonials are submitted by site visitors and moderated for
        appropriateness before publication. They are not verified as originating
        from attendees of a specific event.
      </p>

      {/* Approved testimonials grid */}
      {listItems.length > 0 ? (
        <div className="mt-12">
          <TestimonialList items={listItems} initialPageSize={9} pageSize={9} />
        </div>
      ) : (
        <div className="mt-12 rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-lg font-semibold text-text-light">
            No testimonials yet.
          </p>
          <p className="mt-2 text-sm text-text-light/70">
            Be the first to share your experience using the form below.
          </p>
        </div>
      )}

      {/* Submission form */}
      <div className="mx-auto mt-14 max-w-xl rounded-xl border border-border bg-surface p-8 shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight text-lunar-green">
          Share your experience
        </h2>
        <p className="mt-2 text-sm text-text-light">
          Fields marked with{' '}
          <span aria-hidden="true" className="text-terracotta">
            *
          </span>{' '}
          are required.
        </p>
        <div className="mt-6">
          <TestimonialForm events={events} />
        </div>
      </div>
    </section>
  )
}
