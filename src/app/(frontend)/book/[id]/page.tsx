import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EventCheckout, getCheckoutEvent } from '@/components/booking/EventCheckout'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const event = await getCheckoutEvent(id)
  if (!event) return { title: 'Not found | Malta Food Experience' }
  return {
    title: `Book: ${event.title} | Malta Food Experience`,
    description: `Reserve your seat for ${event.title}.`,
  }
}

/**
 * /book/[id]: Phase 2 booking form entry point.
 *
 * Shows the event summary and the BookingForm via the shared
 * EventCheckout component (also used by /booking/pay?eventId=).
 */
export default async function BookEventPage({ params }: PageProps) {
  const { id } = await params
  const event = await getCheckoutEvent(id)
  if (!event) notFound()

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <header className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-text">
          Reserve your seat
        </span>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.02em] text-lunar-green sm:text-4xl">
          {event.title}
        </h1>
      </header>

      <EventCheckout event={event} />
    </section>
  )
}
