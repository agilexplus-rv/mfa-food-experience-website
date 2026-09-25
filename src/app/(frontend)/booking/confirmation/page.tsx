import type { Metadata } from 'next'

import { ConfirmationStatus } from '@/components/booking/ConfirmationStatus'

export const metadata: Metadata = {
  title: 'Booking confirmation — Malta Food Experience',
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    t?: string    // VIVA TransactionId
    s?: string    // VIVA OrderCode
    session_id?: string  // legacy Stripe
  }>
}

/**
 * /booking/confirmation — VIVA Smart Checkout success_url target
 * (or legacy Stripe Checkout success_url for existing bookings).
 *
 * VIVA appends ?t={TransactionId}&s={OrderCode} to the configured success
 * URL. We resolve the booking by OrderCode (stored as vivaOrderCode) and
 * poll /api/bookings/[id]/status until the webhook flips it to 'confirmed'.
 *
 * Legacy Stripe: ?session_id={CHECKOUT_SESSION_ID} falls through to the
 * old lookup path.
 *
 * This page displays PII (attendee name, email, booking reference) and
 * is excluded from Google Translate per ADR-006 Sec 4 (C17 / DPIA P5).
 */
export default async function BookingConfirmationPage({ searchParams }: PageProps) {
  const { t, s, session_id: sessionId } = await searchParams

  // VIVA: use orderCode (s param) as the lookup key
  const vivaOrderCode = s
  const effectiveSessionId = sessionId ?? (vivaOrderCode ? `viva:${vivaOrderCode}` : undefined)

  return (
    <section className="notranslate mx-auto max-w-2xl px-6 py-20 text-center">
      {effectiveSessionId ? (
        <ConfirmationStatus sessionId={effectiveSessionId} />
      ) : (
        <div>
          <h1 className="text-3xl font-black tracking-[-0.02em] text-lunar-green">Missing booking reference</h1>
          <p className="mt-4 text-text-light">
            We couldn&apos;t find a payment reference for this page. If you completed a payment, check your email
            for your confirmation, or{' '}
            <a href="/contact" className="font-semibold text-terracotta-dark underline">
              contact us
            </a>
            .
          </p>
        </div>
      )}
    </section>
  )
}
