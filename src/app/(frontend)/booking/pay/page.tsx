import type { Metadata } from 'next'
import Link from 'next/link'

import { EventCheckout, getCheckoutEvent } from '@/components/booking/EventCheckout'
import { StatusIcon } from '@/components/booking/StatusIcon'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ eventId?: string }>
}

/** Payload ids are numeric here, but accept any short slug-safe id rather than hard-coding the adapter. */
function parseEventId(value: string | undefined): string | undefined {
  const v = value?.trim()
  return v && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : undefined
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const eventId = parseEventId((await searchParams).eventId)
  const event = eventId ? await getCheckoutEvent(eventId) : null
  return {
    title: event ? `Checkout: ${event.title} | Malta Food Experience` : 'Checkout | Malta Food Experience',
    robots: { index: false, follow: false },
  }
}

const STEPS = ['Your details', 'Secure payment', 'Confirmation'] as const

/**
 * /booking/pay?eventId=...: standalone checkout page.
 *
 * Same event summary + BookingForm as /book/[id] (via EventCheckout), in
 * a checkout layout: progress steps, a note that payment happens on VIVA's
 * hosted page, and friendly states for a missing or unknown eventId
 * instead of a bare 404. On submit BookingForm calls /api/checkout and
 * redirects to VIVA Smart Checkout, which returns the visitor to
 * /booking/confirmation (success) or /booking/cancel (failure).
 *
 * Loading and unexpected errors are handled by loading.tsx / error.tsx.
 */
export default async function BookingPayPage({ searchParams }: PageProps) {
  const rawEventId = (await searchParams).eventId
  const eventId = parseEventId(rawEventId)
  const event = eventId ? await getCheckoutEvent(eventId) : null

  if (!event) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-20 text-center">
        <StatusIcon variant="info" />
        <h1 className="mt-8 text-3xl font-black tracking-[-0.02em] text-lunar-green sm:text-4xl">
          {rawEventId ? 'We couldn’t find this experience' : 'Choose an experience to book'}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-text-light">
          {rawEventId
            ? 'The link you followed may be out of date, or this date may have been removed. Browse our upcoming experiences to find another date.'
            : 'Pick an experience and a date first, then you can reserve your seats here.'}
        </p>
        <div className="mt-10">
          <Link
            href="/services"
            className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta-dark px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-terracotta/85"
          >
            Browse experiences
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/events/${encodeURIComponent(String(event.id))}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-light transition-colors hover:text-lunar-green"
        >
          <span aria-hidden="true">&larr;</span>
          Back to experience
        </Link>

        <ol className="mt-8 flex items-center gap-2 text-xs font-semibold sm:gap-3" aria-label="Checkout progress">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3" aria-current={i === 0 ? 'step' : undefined}>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  i === 0 ? 'bg-terracotta-dark text-white' : 'bg-lunar-green/10 text-text-light'
                }`}
              >
                {i + 1}
              </span>
              <span className={i === 0 ? 'text-lunar-green' : 'text-text-light'}>{label}</span>
              {i < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-border sm:block" aria-hidden="true" />}
            </li>
          ))}
        </ol>

        <header className="mt-10 text-center">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-text">Checkout</span>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.02em] text-lunar-green sm:text-4xl">{event.title}</h1>
        </header>
      </div>

      <EventCheckout event={event} />

      <p className="mx-auto mt-8 flex max-w-2xl items-start justify-center gap-2 text-center text-xs text-text-light">
        <svg className="mt-px h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <span>
          After you select &ldquo;Pay now&rdquo; you&apos;ll be taken to Viva Wallet&apos;s secure checkout to pay,
          then brought back here for your confirmation. We never see or store your card details.
        </span>
      </p>
    </section>
  )
}
