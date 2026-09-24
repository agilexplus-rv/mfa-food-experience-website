import type { Metadata } from 'next'

import { ConfirmationStatus } from '@/components/booking/ConfirmationStatus'

export const metadata: Metadata = {
  title: 'Booking confirmation — Malta Food Experience',
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ session_id?: string }>
}

/**
 * /booking/confirmation — Stripe Checkout success_url target (ADR-004
 * step 4). Stripe only gives us back its own session_id; the actual
 * booking is resolved server/client-side via /api/bookings/by-session,
 * then polled via /api/bookings/[id]/status every 2s until the webhook
 * has flipped it to 'confirmed' (webhook delivery is asynchronous and
 * may arrive after the redirect).
 *
 * This page displays PII (attendee name, email, booking reference) and
 * is excluded from Google Translate per ADR-006 Sec 4 (C17 / DPIA P5).
 */
export default async function BookingConfirmationPage({ searchParams }: PageProps) {
  const { session_id: sessionId } = await searchParams

  return (
    <section className="notranslate mx-auto max-w-2xl px-6 py-20 text-center">
      {sessionId ? (
        <ConfirmationStatus sessionId={sessionId} />
      ) : (
        <div>
          <h1 className="text-3xl font-black tracking-[-0.02em] text-lunar-green">Missing booking reference</h1>
          <p className="mt-4 text-text-light">
            We couldn&apos;t find a payment reference for this page. If you completed a payment, check your email
            for your confirmation, or{' '}
            <a href="/contact" className="font-semibold text-terracotta underline">
              contact us
            </a>
            .
          </p>
        </div>
      )}
    </section>
  )
}
