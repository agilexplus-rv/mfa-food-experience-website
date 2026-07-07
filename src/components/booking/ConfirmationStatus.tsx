'use client'

import { useEffect, useRef, useState } from 'react'

interface BookingStatus {
  id: string | number
  reference: string
  status: string
  persons: number
  totalAmount: number
  eventTitle?: string
}

type State =
  | { phase: 'resolving' }
  | { phase: 'not_found' }
  | { phase: 'polling'; booking: BookingStatus }
  | { phase: 'confirmed'; booking: BookingStatus }

const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 60 // ~2 minutes — generous for webhook delivery latency

export function ConfirmationStatus({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<State>({ phase: 'resolving' })
  const attemptsRef = useRef(0)
  const bookingIdRef = useRef<string | number | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function resolveBooking() {
      try {
        const res = await fetch(`/api/bookings/by-session?session_id=${encodeURIComponent(sessionId)}`)
        if (!res.ok) {
          if (!cancelled) setState({ phase: 'not_found' })
          return
        }
        const data = await res.json()
        bookingIdRef.current = data.id
        void pollStatus()
      } catch {
        if (!cancelled) setState({ phase: 'not_found' })
      }
    }

    async function pollStatus() {
      if (cancelled || bookingIdRef.current === null) return
      attemptsRef.current += 1

      try {
        const res = await fetch(`/api/bookings/${bookingIdRef.current}/status`)
        if (!res.ok) {
          if (!cancelled) setState({ phase: 'not_found' })
          return
        }
        const booking: BookingStatus = await res.json()

        if (cancelled) return

        if (booking.status === 'confirmed' || booking.status === 'checked_in') {
          setState({ phase: 'confirmed', booking })
          return
        }

        setState({ phase: 'polling', booking })

        if (attemptsRef.current < MAX_POLL_ATTEMPTS) {
          timer = setTimeout(() => void pollStatus(), POLL_INTERVAL_MS)
        }
      } catch {
        if (!cancelled && attemptsRef.current < MAX_POLL_ATTEMPTS) {
          timer = setTimeout(() => void pollStatus(), POLL_INTERVAL_MS)
        }
      }
    }

    void resolveBooking()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sessionId])

  if (state.phase === 'resolving') {
    return (
      <div>
        <h1 className="text-3xl font-black tracking-[-0.02em] text-lunar-green">Finding your booking…</h1>
        <p className="mt-4 text-text-light">This will just take a moment.</p>
      </div>
    )
  }

  if (state.phase === 'not_found') {
    return (
      <div>
        <h1 className="text-3xl font-black tracking-[-0.02em] text-lunar-green">We couldn&apos;t find this booking</h1>
        <p className="mt-4 text-text-light">
          If your payment went through, check your email for a confirmation, or{' '}
          <a href="/contact" className="font-semibold text-terracotta underline">
            contact us
          </a>{' '}
          with your payment reference.
        </p>
      </div>
    )
  }

  if (state.phase === 'polling') {
    return (
      <div>
        <h1 className="text-3xl font-black tracking-[-0.02em] text-lunar-green">Confirming your payment…</h1>
        <p className="mt-4 text-text-light">
          Booking reference <span className="font-mono font-semibold">{state.booking.reference}</span> — this
          usually takes a few seconds.
        </p>
      </div>
    )
  }

  const { booking } = state
  return (
    <div>
      <span className="inline-flex items-center rounded-full bg-lunar-green/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-lunar-green">
        Booking confirmed
      </span>
      <h1 className="mt-4 text-3xl font-black tracking-[-0.02em] text-lunar-green">
        {booking.eventTitle ?? 'Your booking'} is confirmed
      </h1>
      <dl className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-6 text-left text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-lunar-green/50">Reference</dt>
          <dd className="font-mono font-semibold text-lunar-green">{booking.reference}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-lunar-green/50">Seats</dt>
          <dd className="font-semibold text-lunar-green">{booking.persons}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-lunar-green/50">Amount paid</dt>
          <dd className="font-semibold text-lunar-green">
            {new Intl.NumberFormat('en-MT', { style: 'currency', currency: 'EUR' }).format(booking.totalAmount)}
          </dd>
        </div>
      </dl>
      <p className="mt-6 text-sm text-text-light">
        A confirmation email with your QR entry code has been sent to the address you provided. Please bring it
        (on your phone or printed) on the day.
      </p>
    </div>
  )
}
