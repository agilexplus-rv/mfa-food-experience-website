import type { Metadata } from 'next'
import Link from 'next/link'

import { StatusIcon } from '@/components/booking/StatusIcon'
import { findBookingByPaymentRef, parseVivaOrderCode, type BookingLookupResult } from '@/lib/bookings/lookup'
import { formatDay, formatTimeRange } from '@/lib/format-date'

export const metadata: Metadata = {
  title: 'Payment not completed | Malta Food Experience',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    s?: string // VIVA OrderCode
  }>
}

const primaryCta =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-terracotta-dark px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-terracotta/85'
const secondaryCta =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-lunar-green/30 px-6 py-3 text-sm font-bold text-lunar-green transition-colors hover:bg-lunar-green/10'

/**
 * /booking/cancel: VIVA Smart Checkout failure URL target.
 *
 * VIVA redirects here when the payment is declined, fails, or the visitor
 * abandons the hosted checkout, appending ?s={OrderCode}. We resolve the
 * booking by vivaOrderCode to show its reference and offer a retry for
 * the same experience. The booking stays 'pending' and its seat hold
 * expires naturally per ADR-002, so there is nothing to clean up here.
 *
 * Edge case: if the webhook has already confirmed the booking (the
 * visitor paid, then landed here anyway), point them at the
 * confirmation page instead of telling them the payment failed.
 *
 * The page shows the booking reference, so its container is excluded from
 * Google Translate per ADR-006 Sec 4 (C17).
 */
export default async function BookingCancelPage({ searchParams }: PageProps) {
  const { s } = await searchParams
  const orderCode = parseVivaOrderCode(s)
  const lookup: BookingLookupResult | null = orderCode
    ? await findBookingByPaymentRef({ vivaOrderCode: orderCode })
    : null

  const booking = lookup?.kind === 'found' ? lookup.booking : null

  if (booking && (booking.status === 'confirmed' || booking.status === 'checked_in')) {
    return (
      <section className="notranslate mx-auto max-w-2xl px-6 py-20 text-center">
        <StatusIcon variant="success" />
        <h1 className="mt-8 text-3xl font-black tracking-[-0.02em] text-lunar-green sm:text-4xl">
          Good news: your payment went through
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-text-light">
          It looks like this booking has already been paid and confirmed. You don&apos;t need to pay again.
        </p>
        <div className="mt-10">
          <Link href={`/booking/confirmation?s=${encodeURIComponent(orderCode!)}`} className={primaryCta}>
            View your booking
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>
    )
  }

  const event = booking?.event ?? null
  const canRetry = event?.status === 'scheduled'

  return (
    <section className="notranslate mx-auto max-w-2xl px-6 py-20 text-center">
      <StatusIcon variant="failed" />

      <h1 className="mt-8 text-3xl font-black tracking-[-0.02em] text-lunar-green sm:text-4xl">
        Your payment wasn&apos;t completed
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-text-light">
        The payment was cancelled or declined, so your booking has not been confirmed and{' '}
        <strong className="font-semibold text-lunar-green">no payment has been taken</strong>. If your bank shows a
        pending charge, it will be released automatically.
      </p>

      {booking && (
        <div className="mx-auto mt-10 max-w-md overflow-hidden rounded-xl border border-border bg-surface text-left shadow-sm">
          <div className="border-b border-dashed border-border bg-terracotta/5 px-6 py-3">
            <span className="text-xs font-bold uppercase tracking-wide text-terracotta-dark">Not confirmed</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-5 text-sm">
            {event && (
              <div className="col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">Experience</dt>
                <dd className="font-semibold text-lunar-green">{event.title}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">Reference</dt>
              <dd className="font-mono font-semibold text-lunar-green">{booking.reference}</dd>
            </div>
            {event && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">Date</dt>
                <dd className="font-semibold text-lunar-green">
                  {formatDay(event.date)}
                  <span className="block text-xs font-normal text-text-light">
                    {formatTimeRange(event.startTime, event.endTime)}
                  </span>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <p className="mx-auto mt-8 max-w-lg text-sm text-text-light">
        {canRetry
          ? 'Your held seats will be released shortly. Seats are not guaranteed until payment is complete, so try again soon if you still want to join us.'
          : 'Any seats held for you will be released shortly so others can book them.'}
      </p>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {canRetry && event ? (
          <>
            <Link href={`/booking/pay?eventId=${encodeURIComponent(String(event.id))}`} className={primaryCta}>
              Try again
              <span aria-hidden="true">&rarr;</span>
            </Link>
            <Link href="/services" className={secondaryCta}>
              Browse experiences
            </Link>
          </>
        ) : (
          <Link href="/services" className={primaryCta}>
            Browse experiences
            <span aria-hidden="true">&rarr;</span>
          </Link>
        )}
      </div>

      <p className="mt-10 text-xs text-text-light">
        Having trouble paying?{' '}
        <Link href="/contact" className="font-semibold text-terracotta-dark underline">
          Contact us
        </Link>
        {booking ? (
          <>
            {' '}
            and quote reference <span className="font-mono font-semibold">{booking.reference}</span>.
          </>
        ) : lookup?.kind === 'error' ? (
          <> and we&apos;ll look into it.</>
        ) : (
          <> and we&apos;ll help you complete your booking.</>
        )}
      </p>
    </section>
  )
}
