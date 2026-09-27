'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import type { BookingEventSummary, BookingSummary } from '@/lib/bookings/lookup'
import { formatPrice } from '@/lib/availability-types'
import { formatDay, formatTimeRange } from '@/lib/format-date'
import { CalendarAndShare } from './CalendarAndShare'
import { StatusIcon } from './StatusIcon'

/** Shape returned by /api/bookings/[id]/status (no PII by design). */
interface BookingStatus {
  id: string | number
  reference: string
  status: string
  persons: number
  totalAmount: number
  eventTitle?: string
}

/**
 * What the card renders: the polled status fields, plus the PII/event
 * details the confirmation page resolved server-side (absent when we had
 * to fall back to the client-side by-session lookup).
 */
interface ViewBooking extends BookingStatus {
  event?: BookingEventSummary | null
  leadAttendeeName?: string
  email?: string
}

type State =
  | { phase: 'resolving' }
  | { phase: 'not_found' }
  | { phase: 'error' }
  | { phase: 'polling'; booking: ViewBooking }
  | { phase: 'timeout'; booking: ViewBooking }
  | { phase: 'confirmed'; booking: ViewBooking }
  | { phase: 'cancelled'; booking: ViewBooking }

const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 60 // ~2 minutes, generous for webhook delivery latency

function isConfirmed(status: string) {
  return status === 'confirmed' || status === 'checked_in'
}

function phaseFor(booking: ViewBooking): State {
  if (isConfirmed(booking.status)) return { phase: 'confirmed', booking }
  if (booking.status === 'cancelled') return { phase: 'cancelled', booking }
  return { phase: 'polling', booking }
}

function initialState(initialBooking: BookingSummary | null | undefined): State {
  if (!initialBooking) return { phase: 'resolving' }
  return phaseFor({ ...initialBooking, eventTitle: initialBooking.event?.title })
}

interface ConfirmationStatusProps {
  /**
   * Lookup key for /api/bookings/by-session: "viva:{OrderCode}" for VIVA,
   * or the Stripe Checkout Session id for legacy bookings.
   */
  sessionId: string
  /** VIVA TransactionId (?t=), shown on the card as the payment reference. */
  transactionId?: string
  /**
   * Booking resolved server-side by the page. When present we skip the
   * by-session lookup and can show PII (lead name, email) and event
   * details the unauthenticated status endpoint deliberately omits.
   */
  initialBooking?: BookingSummary | null
}

export function ConfirmationStatus({ sessionId, transactionId, initialBooking }: ConfirmationStatusProps) {
  const [state, setState] = useState<State>(() => initialState(initialBooking))
  // Bumped by "Check again" to restart polling after a timeout / error.
  const [pollRun, setPollRun] = useState(0)
  const initialRef = useRef(initialBooking)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0

    const initial = initialRef.current
    // Details the status endpoint doesn't return; carried across polls.
    const extra: Pick<ViewBooking, 'event' | 'leadAttendeeName' | 'email'> = initial
      ? { event: initial.event, leadAttendeeName: initial.leadAttendeeName, email: initial.email }
      : {}
    let bookingId: string | number | null = initial?.id ?? null
    let last: ViewBooking | null = initial ? { ...initial, eventTitle: initial.event?.title } : null

    function scheduleOrGiveUp() {
      if (cancelled) return
      if (attempts < MAX_POLL_ATTEMPTS) {
        timer = setTimeout(() => void pollStatus(), POLL_INTERVAL_MS)
      } else {
        setState(last ? { phase: 'timeout', booking: last } : { phase: 'error' })
      }
    }

    async function resolveBooking() {
      try {
        const res = await fetch(`/api/bookings/by-session?session_id=${encodeURIComponent(sessionId)}`)
        if (cancelled) return
        if (res.status === 404 || res.status === 400) {
          setState({ phase: 'not_found' })
          return
        }
        if (!res.ok) {
          setState({ phase: 'error' })
          return
        }
        const data: { id: string | number } = await res.json()
        bookingId = data.id
        void pollStatus()
      } catch {
        if (!cancelled) setState({ phase: 'error' })
      }
    }

    async function pollStatus() {
      if (cancelled || bookingId === null) return
      attempts += 1

      try {
        const res = await fetch(`/api/bookings/${bookingId}/status`, { cache: 'no-store' })
        if (cancelled) return
        if (res.status === 404) {
          setState({ phase: 'not_found' })
          return
        }
        if (!res.ok) {
          scheduleOrGiveUp()
          return
        }
        const status: BookingStatus = await res.json()
        if (cancelled) return

        last = { ...extra, ...status, eventTitle: status.eventTitle ?? extra.event?.title }
        const next = phaseFor(last)
        setState(next)
        if (next.phase === 'polling') scheduleOrGiveUp()
      } catch {
        scheduleOrGiveUp()
      }
    }

    // Nothing to wait for if the server already saw a final status.
    const alreadyFinal =
      pollRun === 0 && initial && (isConfirmed(initial.status) || initial.status === 'cancelled')

    if (!alreadyFinal) {
      if (bookingId !== null) void pollStatus()
      else void resolveBooking()
    }

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sessionId, pollRun])

  function checkAgain() {
    setState((s) => ('booking' in s ? { phase: 'polling', booking: s.booking } : { phase: 'resolving' }))
    setPollRun((n) => n + 1)
  }

  if (state.phase === 'resolving') {
    return (
      <Header
        variant="pending"
        title="Finding your booking…"
        body="This will just take a moment."
        live
      />
    )
  }

  if (state.phase === 'not_found') {
    return (
      <>
        <Header
          variant="info"
          title="We couldn't find this booking"
          body="If your payment went through, you'll receive a confirmation email shortly. If it doesn't arrive, contact us with your payment reference and we'll sort it out."
        />
        {transactionId && <PaymentReference transactionId={transactionId} />}
        <Actions />
      </>
    )
  }

  if (state.phase === 'error') {
    return (
      <>
        <Header
          variant="info"
          title="We couldn't load your booking"
          body="Your payment is not affected. This is usually a temporary connection problem, so please try again. You'll also receive a confirmation email once your booking is confirmed."
        />
        {transactionId && <PaymentReference transactionId={transactionId} />}
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={checkAgain} className={primaryButton}>
            Try again
          </button>
        </div>
      </>
    )
  }

  const { booking } = state

  if (state.phase === 'cancelled') {
    return (
      <>
        <Header
          variant="failed"
          title="This booking is no longer active"
          body="This booking was cancelled, for example because the payment didn't complete before your seat hold expired. If you were charged, contact us with the references below and we'll put it right."
        />
        <Ticket booking={booking} transactionId={transactionId} tone="failed" />
        <Actions contact />
      </>
    )
  }

  if (state.phase === 'polling' || state.phase === 'timeout') {
    const timedOut = state.phase === 'timeout'
    return (
      <>
        <Header
          variant="pending"
          title={timedOut ? 'Still confirming your payment' : 'Confirming your payment…'}
          body={
            timedOut
              ? "VIVA is taking longer than usual to confirm your payment. You don't need to pay again: we'll email you as soon as it's confirmed."
              : 'Your payment was received by VIVA and we are confirming your booking. This usually takes a few seconds.'
          }
          live
        />
        <Ticket booking={booking} transactionId={transactionId} tone="pending" />
        {timedOut && (
          <div className="mt-8 flex justify-center">
            <button type="button" onClick={checkAgain} className={primaryButton}>
              Check again
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <Header
        variant="success"
        title="You're booked!"
        body={
          booking.email ? (
            <>
              We&apos;ve sent your confirmation and QR entry code to{' '}
              <strong className="font-semibold text-lunar-green">{booking.email}</strong>. Bring it on your phone or
              printed on the day.
            </>
          ) : (
            'A confirmation email with your QR entry code has been sent to the address you provided. Bring it on your phone or printed on the day.'
          )
        }
        live
      />
      <Ticket booking={booking} transactionId={transactionId} tone="success" />
      {booking.event && <CalendarAndShare event={booking.event} reference={booking.reference} persons={booking.persons} />}
      <p className="mt-10 text-sm text-text-light">
        Need to change something?{' '}
        <Link href="/contact" className="font-semibold text-terracotta-dark underline">
          Contact us
        </Link>{' '}
        and quote your booking reference.
      </p>
    </>
  )
}

/* ── Presentational pieces ─────────────────────────────────────────── */

const primaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-terracotta-dark px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-terracotta/85'
const secondaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-lunar-green/30 px-6 py-3 text-sm font-bold text-lunar-green transition-colors hover:bg-lunar-green/10'

function Header({
  variant,
  title,
  body,
  live,
}: {
  variant: 'success' | 'pending' | 'failed' | 'info'
  title: string
  body: React.ReactNode
  live?: boolean
}) {
  return (
    <div role={live ? 'status' : undefined} aria-live={live ? 'polite' : undefined}>
      <StatusIcon variant={variant} />
      <h1 className="mt-8 text-3xl font-black tracking-[-0.02em] text-lunar-green sm:text-4xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-lg text-text-light">{body}</p>
    </div>
  )
}

const TONE = {
  success: { band: 'bg-lunar-green text-white', pill: 'bg-white/15 text-white', label: 'Confirmed' },
  pending: { band: 'bg-matte-gold/15 text-lunar-green', pill: 'bg-matte-gold/25 text-accent-text', label: 'Confirming payment' },
  failed: { band: 'bg-terracotta/10 text-lunar-green', pill: 'bg-terracotta/15 text-terracotta-dark', label: 'Cancelled' },
} as const

/**
 * Ticket-style summary card. Contains PII (lead name, email, reference),
 * so it is excluded from Google Translate per ADR-006 Sec 4.
 */
function Ticket({
  booking,
  transactionId,
  tone,
}: {
  booking: ViewBooking
  transactionId?: string
  tone: keyof typeof TONE
}) {
  const t = TONE[tone]
  const title = booking.event?.title ?? booking.eventTitle ?? 'Your experience'
  const event = booking.event
  const time = event ? formatTimeRange(event.startTime, event.endTime) : ''

  return (
    <article className="notranslate relative mx-auto mt-10 max-w-md text-left drop-shadow-sm" aria-label="Booking summary">
      <div className={`rounded-t-2xl px-6 pb-6 pt-5 ${t.band}`}>
        <div className="flex items-start justify-between gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Malta Food Experience</span>
          <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${t.pill}`}>
            {t.label}
          </span>
        </div>
        <h2 className="mt-3 text-xl font-black leading-tight tracking-[-0.02em]">{title}</h2>
        {event && (
          <p className="mt-2 text-sm opacity-90">
            {formatDay(event.date, 'long')}
            {time && <> &middot; {time}</>}
          </p>
        )}
        {event?.locationRef && <p className="mt-0.5 text-sm opacity-75">{event.locationRef}</p>}
      </div>

      {/* Perforation: notches punched out with the page background colour. */}
      <div className="relative h-0 border-t-2 border-dashed border-border bg-surface" aria-hidden="true">
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-background" />
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-background" />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-b-2xl bg-surface px-6 py-6 text-sm">
        <Field label="Reference">
          <span className="font-mono text-base font-bold tracking-wide">{booking.reference}</span>
        </Field>
        <Field label="Guests">
          {booking.persons} {booking.persons === 1 ? 'person' : 'people'}
        </Field>
        {booking.leadAttendeeName && (
          <Field label="Lead guest" wide>
            {booking.leadAttendeeName}
          </Field>
        )}
        {booking.email && (
          <Field label="Email" wide>
            <span className="break-all">{booking.email}</span>
          </Field>
        )}
        <Field label={tone === 'success' ? 'Amount paid' : 'Amount'}>
          {formatPrice(booking.totalAmount)}
          <span className="block text-xs font-normal text-text-light">inc. VAT</span>
        </Field>
        {transactionId && (
          <Field label="VIVA transaction ID" wide>
            <span className="break-all font-mono text-xs font-medium">{transactionId}</span>
          </Field>
        )}
      </dl>
    </article>
  )
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">{label}</dt>
      <dd className="mt-0.5 font-semibold text-lunar-green">{children}</dd>
    </div>
  )
}

function PaymentReference({ transactionId }: { transactionId: string }) {
  return (
    <p className="notranslate mx-auto mt-6 max-w-md rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-light">
      Payment reference{' '}
      <span className="break-all font-mono text-xs font-semibold text-lunar-green">{transactionId}</span>
    </p>
  )
}

function Actions({ contact }: { contact?: boolean }) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
      <Link href="/contact" className={contact ? primaryButton : secondaryButton}>
        Contact us
      </Link>
      <Link href="/services" className={contact ? secondaryButton : primaryButton}>
        Browse experiences
      </Link>
    </div>
  )
}
