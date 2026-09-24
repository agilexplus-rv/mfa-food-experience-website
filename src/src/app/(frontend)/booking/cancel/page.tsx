import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Booking not completed — Malta Food Experience',
}

/**
 * /booking/cancel — Stripe Checkout cancel_url target (ADR-004).
 * Reached when the visitor abandons the Stripe-hosted payment page.
 * The booking remains 'pending' and its seat hold expires naturally
 * per ADR-002 — nothing to clean up here, just a friendly message.
 */
export default function BookingCancelPage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="text-3xl font-black tracking-[-0.02em] text-lunar-green">Booking not completed</h1>
      <p className="mt-4 text-text-light">
        Your payment was not completed, so your seats have not been booked. Your held seats will be released
        shortly so others can book them.
      </p>
      <div className="mt-8">
        <Link
          href="/services"
          className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta px-6 py-3 text-sm font-bold text-soft-beige transition-colors hover:bg-terracotta/85"
        >
          Browse experiences
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
    </section>
  )
}
