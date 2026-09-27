import type { Metadata } from 'next'
import Link from 'next/link'

import { ConfirmationStatus } from '@/components/booking/ConfirmationStatus'
import { StatusIcon } from '@/components/booking/StatusIcon'
import {
  findBookingByPaymentRef,
  parseStripeSessionId,
  parseVivaOrderCode,
  parseVivaTransactionId,
  type BookingLookupResult,
} from '@/lib/bookings/lookup'

export const metadata: Metadata = {
  title: 'Booking confirmation | Malta Food Experience',
  robots: { index: false, follow: false },
  // The URL carries the VIVA OrderCode, which unlocks the booking details; don't leak it to third parties.
  referrer: 'no-referrer',
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
 * /booking/confirmation: VIVA Smart Checkout success_url target
 * (or legacy Stripe Checkout success_url for existing bookings).
 *
 * VIVA appends ?t={TransactionId}&s={OrderCode} to the configured success
 * URL. We resolve the booking by OrderCode (stored as vivaOrderCode)
 * server-side, so the ticket card can show the lead guest, email and
 * event details that the unauthenticated status endpoint deliberately
 * omits, then ConfirmationStatus polls /api/bookings/[id]/status until
 * the webhook flips it to 'confirmed'. The TransactionId is displayed
 * as the payment reference only; confirmation always comes from the
 * webhook, never from the redirect.
 *
 * Legacy Stripe: ?session_id={CHECKOUT_SESSION_ID} falls through to the
 * old lookup path.
 *
 * If the server-side lookup errors or finds nothing, ConfirmationStatus
 * falls back to the client-side /api/bookings/by-session lookup (no PII
 * in that path) and shows its own not-found / retry states.
 *
 * This page displays PII (attendee name, email, booking reference) and
 * is excluded from Google Translate per ADR-006 Sec 4 (C17 / DPIA P5).
 */
export default async function BookingConfirmationPage({ searchParams }: PageProps) {
  const { t, s, session_id } = await searchParams

  const orderCode = parseVivaOrderCode(s)
  const stripeSessionId = orderCode ? undefined : parseStripeSessionId(session_id)
  const transactionId = parseVivaTransactionId(t)

  const lookupKey = orderCode ? `viva:${orderCode}` : stripeSessionId

  let lookup: BookingLookupResult | null = null
  if (orderCode) lookup = await findBookingByPaymentRef({ vivaOrderCode: orderCode })
  else if (stripeSessionId) lookup = await findBookingByPaymentRef({ stripeSessionId })

  return (
    <section className="notranslate mx-auto max-w-2xl px-6 py-20 text-center">
      {lookupKey ? (
        <ConfirmationStatus
          sessionId={lookupKey}
          transactionId={transactionId}
          initialBooking={lookup?.kind === 'found' ? lookup.booking : null}
        />
      ) : (
        <MissingReference hadParams={Boolean(s || session_id || t)} transactionId={transactionId} />
      )}
    </section>
  )
}

function MissingReference({ hadParams, transactionId }: { hadParams: boolean; transactionId?: string }) {
  return (
    <div>
      <StatusIcon variant="info" />
      <h1 className="mt-8 text-3xl font-black tracking-[-0.02em] text-lunar-green sm:text-4xl">
        {hadParams ? 'We couldn’t read your payment reference' : 'Missing booking reference'}
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-text-light">
        We couldn&apos;t find a payment reference for this page. If you completed a payment, you&apos;ll receive a
        confirmation email with your booking reference and QR entry code shortly.
      </p>
      {transactionId && (
        <p className="mx-auto mt-6 max-w-md rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-light">
          Payment reference{' '}
          <span className="break-all font-mono text-xs font-semibold text-lunar-green">{transactionId}</span>
        </p>
      )}
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/contact"
          className="inline-flex items-center justify-center rounded-lg bg-terracotta-dark px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-terracotta/85"
        >
          Contact us
        </Link>
        <Link
          href="/services"
          className="inline-flex items-center justify-center rounded-lg border border-lunar-green/30 px-6 py-3 text-sm font-bold text-lunar-green transition-colors hover:bg-lunar-green/10"
        >
          Browse experiences
        </Link>
      </div>
    </div>
  )
}
