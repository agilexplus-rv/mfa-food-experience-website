'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { formatPrice } from '@/lib/availability-types'

export interface BookingFormProps {
  eventId: string | number
  pricePerPerson: number
  /** Upper bound for the seats input — min(20, remaining availability). */
  maxSeats: number
  /**
   * Article 16(l) / 6(1)(k) withdrawal-right disclosure text, fetched
   * server-side from the CancellationPolicy Global and passed as a prop.
   * When null, the disclosure block is not rendered (policy unavailable).
   */
  withdrawalRightDisclosure?: string | null
  /**
   * Whether the CancellationPolicy Global's `enabled` flag is on.
   * Controls the wording of the cancellation acknowledgement checkbox.
   */
  cancellationEnabled?: boolean
}

/** Cloudflare Turnstile site key. Exposed to the client as NEXT_PUBLIC_*. */
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

interface HoldState {
  id: string | number
  expiresAt: string
  seats: number
}

// Augment window for the Turnstile widget API
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string | undefined
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
    turnstileToken?: string
  }
}

function newSessionId(): string {
  // Not a security token — just a stable per-tab cart identifier the
  // hold/checkout APIs use to correlate a hold with its eventual booking.
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`
}

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return '0:00'
  const totalSeconds = Math.floor(msRemaining / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * BookingForm — the Phase 2 checkout entry point.
 *
 * Flow (ADR-002 / ADR-004):
 * 1. On mount, acquire a seat hold for 1 seat (the minimum) so the
 *    countdown timer starts immediately; re-acquire if the visitor
 *    changes the seat count (release the old hold first).
 * 2. Show a live countdown of the hold's remaining time.
 * 3. Collect attendee details, optional dietary info + consent,
 *    optional coupon code (previewed via /api/coupons/validate,
 *    NOT consumed until payment completes — ADR-005), and the
 *    cancellation-policy acknowledgement checkbox.
 * 4. On submit, call /api/checkout and redirect to the returned
 *    Stripe URL. Button text is "Pay now" per ADR-004 / EU Legal D.5.
 * 5. If the hold expires before submit, block submission and offer to
 *    re-acquire a fresh hold rather than silently failing at checkout.
 *
 * @at-compliance EU-Legal-5 (Art. 16(l) / 6(1)(k) withdrawal-right
 *   disclosure rendered directly on the booking page before payment)
 * @at-compliance ADR-008 C16 (Cloudflare Turnstile bot mitigation)
 */
export function BookingForm({ eventId, pricePerPerson, maxSeats, withdrawalRightDisclosure, cancellationEnabled }: BookingFormProps) {
  const sessionIdRef = useRef<string>(newSessionId())
  const [seats, setSeats] = useState(1)
  const [hold, setHold] = useState<HoldState | null>(null)
  const [holdError, setHoldError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const [leadAttendeeName, setLeadAttendeeName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dietaryNotes, setDietaryNotes] = useState('')
  const [dietaryConsent, setDietaryConsent] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponStatus, setCouponStatus] = useState<
    { state: 'idle' } | { state: 'checking' } | { state: 'valid'; totalAfterDiscount: number } | { state: 'invalid'; message: string }
  >({ state: 'idle' })
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Turnstile
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | undefined>(undefined)

  const acquireHold = useCallback(
    async (requestedSeats: number) => {
      setHoldError(null)
      try {
        const res = await fetch('/api/holds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, seats: requestedSeats, sessionId: sessionIdRef.current }),
        })
        const data = await res.json()
        if (!res.ok) {
          setHold(null)
          setHoldError(
            data.error === 'insufficient_seats'
              ? `Only ${data.remaining} seat${data.remaining === 1 ? '' : 's'} left — please lower the number of seats.`
              : 'Could not reserve your seats. Please try again.',
          )
          return
        }
        setHold(data.hold)
      } catch {
        setHold(null)
        setHoldError('Could not reserve your seats — check your connection and try again.')
      }
    },
    [eventId],
  )

  // Load Turnstile script + render widget on mount (only if site key is set).
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileRef.current) return

    const existingScript = document.querySelector('script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]')
    if (!existingScript) {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    const renderWidget = () => {
      if (!turnstileRef.current || !window.turnstile) return
      if (turnstileWidgetId.current) return // already rendered
      try {
        const id = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => {
            window.turnstileToken = token
          },
          'expired-callback': () => {
            window.turnstileToken = undefined
          },
          'error-callback': () => {
            window.turnstileToken = undefined
          },
        })
        turnstileWidgetId.current = id
      } catch {
        // Widget render failed — degrade gracefully (checkout will skip verification
        // or show bot_check_required depending on server config).
      }
    }

    if (window.turnstile) {
      renderWidget()
    } else {
      // Script hasn't loaded yet — wait for it
      const onLoad = () => renderWidget()
      window.addEventListener('load', onLoad)
      // Also try after a short delay in case the script loads after window.onload
      const timeout = setTimeout(renderWidget, 3000)
      return () => {
        window.removeEventListener('load', onLoad)
        clearTimeout(timeout)
      }
    }
  }, [])

  // Acquire the initial hold on mount.
  useEffect(() => {
    void acquireHold(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Release the hold on unmount (best-effort — the sweeper is the safety net).
  useEffect(() => {
    return () => {
      const current = hold
      if (current) {
        void fetch(`/api/holds/${current.id}`, { method: 'DELETE' }).catch(() => undefined)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live countdown tick.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const handleSeatsChange = useCallback(
    (next: number) => {
      const clamped = Math.max(1, Math.min(maxSeats, next))
      setSeats(clamped)
      const previousHold = hold
      void acquireHold(clamped).then(() => {
        if (previousHold) {
          void fetch(`/api/holds/${previousHold.id}`, { method: 'DELETE' }).catch(() => undefined)
        }
      })
    },
    [acquireHold, hold, maxSeats],
  )

  const validateCoupon = useCallback(async () => {
    const code = couponCode.trim()
    if (!code) {
      setCouponStatus({ state: 'idle' })
      return
    }
    setCouponStatus({ state: 'checking' })
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, eventId, seats }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        const messages: Record<string, string> = {
          not_found: 'We don\u2019t recognise this code.',
          inactive: 'This code is no longer active.',
          not_yet_valid: 'This code isn\u2019t valid yet.',
          expired: 'This code has expired.',
          exhausted: 'This code has reached its usage limit.',
          not_applicable_to_service: 'This code doesn\u2019t apply to this experience.',
          event_not_found: 'This code is not valid for this event.',
        }
        setCouponStatus({ state: 'invalid', message: messages[data.error] ?? 'This code is not valid for this event.' })
        return
      }
      setCouponStatus({ state: 'valid', totalAfterDiscount: data.totalAfterDiscount })
    } catch {
      setCouponStatus({ state: 'invalid', message: 'Could not check this code — please try again.' })
    }
  }, [couponCode, eventId, seats])

  const holdMsRemaining = hold ? new Date(hold.expiresAt).getTime() - now : 0
  const holdExpired = Boolean(hold) && holdMsRemaining <= 0

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitError(null)

      if (!hold || holdExpired) {
        setSubmitError('Your seat hold has expired — please reserve again before paying.')
        return
      }
      if (!policyAccepted) {
        setSubmitError('Please confirm you have read the cancellation policy.')
        return
      }

      setSubmitting(true)
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            holdId: hold.id,
            sessionId: sessionIdRef.current,
            seats,
            leadAttendeeName,
            email,
            phone: phone || undefined,
            language: 'en',
            dietaryNotes: dietaryConsent ? dietaryNotes : undefined,
            dietaryConsent,
            couponCode: couponStatus.state === 'valid' ? couponCode.trim() : undefined,
            cancellationPolicyAccepted: true,
            turnstileToken: window.turnstileToken,
          }),
        })
        const data = await res.json()

        if (res.status === 503 && data.error === 'payments_not_configured') {
          setSubmitError(
            'Online payment is being finalised and isn\u2019t available just yet. Your seats are held as pending \u2014 please check back soon, or contact us directly to complete your booking.',
          )
          return
        }
        if (!res.ok) {
          const messages: Record<string, string> = {
            hold_not_found_or_expired: 'Your seat hold has expired — please reserve again before paying.',
            hold_mismatch: 'Your seat hold no longer matches this booking — please refresh and try again.',
            hold_expired: 'Your seat hold has expired — please reserve again before paying.',
            seats_mismatch: 'The number of seats changed — please refresh and try again.',
            event_not_found: 'This event could not be found.',
            event_not_bookable: 'This event is no longer bookable.',
            insufficient_seats: 'There aren\u2019t enough seats left for this booking.',
            invalid_coupon: 'Your discount code is no longer valid — remove it and try again.',
            invalid_input: 'Please check the details you entered and try again.',
            stripe_error: 'We couldn\u2019t start the payment — please try again in a moment.',
            bot_check_required: 'Please complete the security check below.',
            bot_check_failed: 'Security check failed — please try again.',
          }
          setSubmitError(data.message ?? messages[data.error] ?? 'Something went wrong — please try again.')
          return
        }
        if (data.url) {
          window.location.href = data.url
          return
        }
        setSubmitError('Something went wrong — please try again.')
      } catch {
        setSubmitError('Could not reach the server — check your connection and try again.')
      } finally {
        setSubmitting(false)
      }
    },
    [couponCode, couponStatus.state, dietaryConsent, dietaryNotes, email, eventId, hold, holdExpired, leadAttendeeName, phone, seats, policyAccepted],
  )

  const baseTotal = pricePerPerson * seats
  const displayTotal = couponStatus.state === 'valid' ? couponStatus.totalAfterDiscount : baseTotal

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-8">
      {/* Hold status / countdown */}
      <div
        className={`rounded-xl border px-5 py-4 text-sm ${
          holdExpired
            ? 'border-terracotta/40 bg-terracotta/10 text-terracotta'
            : 'border-matte-gold/40 bg-matte-gold/10 text-lunar-green'
        }`}
      >
        {holdError ? (
          <p className="font-semibold">{holdError}</p>
        ) : holdExpired ? (
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Your seat hold has expired.</p>
            <button
              type="button"
              onClick={() => void acquireHold(seats)}
              className="rounded-lg bg-terracotta px-4 py-2 text-xs font-bold text-soft-beige transition-colors hover:bg-terracotta/85"
            >
              Reserve again
            </button>
          </div>
        ) : hold ? (
          <p>
            Your seats are held for{' '}
            <span className="font-mono font-bold tabular-nums">{formatCountdown(holdMsRemaining)}</span>{' '}
            minutes while you complete this form.
          </p>
        ) : (
          <p>Reserving your seats…</p>
        )}
      </div>

      {/* Seats */}
      <div>
        <label htmlFor="seats" className="block text-sm font-semibold text-lunar-green">
          Number of seats
        </label>
        <input
          id="seats"
          type="number"
          min={1}
          max={maxSeats}
          value={seats}
          onChange={(e) => handleSeatsChange(Number(e.target.value) || 1)}
          className="mt-2 w-32 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
        />
      </div>

      {/* Attendee details */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-lunar-green">Your details</legend>
        <div>
          <label htmlFor="leadAttendeeName" className="block text-xs font-semibold uppercase tracking-wide text-lunar-green/60">
            Full name *
          </label>
          <input
            id="leadAttendeeName"
            type="text"
            required
            value={leadAttendeeName}
            onChange={(e) => setLeadAttendeeName(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-lunar-green/60">
            Email *
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
          />
          <p className="mt-1 text-xs text-text-light">Your booking confirmation and QR entry code will be sent here.</p>
        </div>
        <div>
          <label htmlFor="phone" className="block text-xs font-semibold uppercase tracking-wide text-lunar-green/60">
            Phone (optional)
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
          />
        </div>
      </fieldset>

      {/* Dietary — data-minimised, explicit consent (DPIA measure 5) */}
      <fieldset className="space-y-3 rounded-xl border border-border bg-surface/60 p-4">
        <legend className="px-1 text-sm font-semibold text-lunar-green">Dietary requirements (optional)</legend>
        <label className="flex items-start gap-2.5 text-sm text-lunar-green">
          <input
            type="checkbox"
            checked={dietaryConsent}
            onChange={(e) => setDietaryConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-terracotta focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
          />
          <span>I&apos;d like to share dietary requirements or allergies with the host.</span>
        </label>
        {dietaryConsent && (
          <textarea
            value={dietaryNotes}
            onChange={(e) => setDietaryNotes(e.target.value)}
            rows={3}
            placeholder="e.g. nut allergy, vegetarian, gluten-free"
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
          />
        )}
      </fieldset>

      {/* Coupon */}
      <div>
        <label htmlFor="coupon" className="block text-xs font-semibold uppercase tracking-wide text-lunar-green/60">
          Discount code (optional)
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="coupon"
            type="text"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value)
              setCouponStatus({ state: 'idle' })
            }}
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm uppercase focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
          />
          <button
            type="button"
            onClick={() => void validateCoupon()}
            disabled={couponStatus.state === 'checking'}
            className="rounded-lg border border-lunar-green/30 px-4 py-2.5 text-xs font-bold text-lunar-green transition-colors hover:bg-lunar-green/10 disabled:opacity-50"
          >
            {couponStatus.state === 'checking' ? 'Checking…' : 'Apply'}
          </button>
        </div>
        {couponStatus.state === 'valid' && (
          <p className="mt-1.5 text-xs font-semibold text-lunar-green">Code applied — total updated below.</p>
        )}
        {couponStatus.state === 'invalid' && (
          <p className="mt-1.5 text-xs font-semibold text-terracotta">{couponStatus.message}</p>
        )}
      </div>

      {/* Article 16(l) / 6(1)(k) withdrawal-right disclosure —
          surfaced directly on the booking page before payment,
          per EU Consumer Rights Directive.
          @at-compliance EU-Legal-5 */}
      {withdrawalRightDisclosure && (
        <div className="rounded-xl border border-matte-gold/30 bg-matte-gold/5 px-5 py-4 text-sm">
          <p className="text-lunar-green/75 leading-relaxed">
            {withdrawalRightDisclosure}
          </p>
        </div>
      )}

      {/* Cancellation policy acknowledgement */}
      <label className="flex items-start gap-2.5 text-sm text-lunar-green">
        <input
          type="checkbox"
          checked={policyAccepted}
          onChange={(e) => setPolicyAccepted(e.target.checked)}
          required
          className="mt-0.5 h-4 w-4 rounded border-border text-terracotta focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
        />
        <span>
          {cancellationEnabled === false ? (
            <>
              I understand that this booking{' '}
              <strong className="font-semibold text-terracotta">cannot be cancelled or refunded</strong>
              {'. '}
            </>
          ) : (
            <>
              I have read and accept the{' '}
              <a href="/legal/cancellation-policy" target="_blank" rel="noreferrer" className="font-semibold underline">
                Cancellation Policy
              </a>
              {'. '}
            </>
          )}
        </span>
      </label>

      {/* Cloudflare Turnstile — bot mitigation (ADR-008 C16).
          Only rendered when the site key is configured. */}
      {TURNSTILE_SITE_KEY && (
        <div className="flex justify-center">
          <div ref={turnstileRef} />
        </div>
      )}

      {/* Total + submit */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-lunar-green">Total</span>
          <span className="text-2xl font-black text-lunar-green">{formatPrice(displayTotal)}</span>
        </div>
        {couponStatus.state === 'valid' && displayTotal !== baseTotal && (
          <p className="mt-1 text-right text-xs text-text-light line-through">{formatPrice(baseTotal)}</p>
        )}

        {submitError && (
          <p className="mt-4 rounded-lg bg-terracotta/10 px-4 py-3 text-sm font-semibold text-terracotta">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !hold || holdExpired}
          className="mt-5 w-full rounded-lg bg-terracotta px-6 py-3.5 text-base font-bold text-soft-beige transition-colors hover:bg-terracotta/85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Processing…' : 'Pay now'}
        </button>
      </div>
    </form>
  )
}
