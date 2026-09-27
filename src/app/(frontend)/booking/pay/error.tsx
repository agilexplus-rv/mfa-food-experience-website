'use client'

import Link from 'next/link'
import { useEffect } from 'react'

import { StatusIcon } from '@/components/booking/StatusIcon'

/** Error boundary for /booking/pay (e.g. availability or policy lookups failing). */
export default function BookingPayError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[booking/pay] Checkout page failed to render:', error)
  }, [error])

  return (
    <section className="mx-auto max-w-2xl px-6 py-20 text-center">
      <StatusIcon variant="failed" />
      <h1 className="mt-8 text-3xl font-black tracking-[-0.02em] text-lunar-green sm:text-4xl">
        We couldn&apos;t load the checkout
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-text-light">
        Something went wrong on our side. No booking has been made and you have not been charged. Please try again in a
        moment.
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-terracotta-dark px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-terracotta/85"
        >
          Try again
        </button>
        <Link
          href="/services"
          className="inline-flex items-center justify-center rounded-lg border border-lunar-green/30 px-6 py-3 text-sm font-bold text-lunar-green transition-colors hover:bg-lunar-green/10"
        >
          Browse experiences
        </Link>
      </div>
    </section>
  )
}
