import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { checkoutSchema } from '@/lib/validations/booking'
import { getAvailability } from '@/lib/availability'
import { getSeatHold, releaseSeatHold } from '@/lib/bookings/seat-holds'
import { generateBookingReference } from '@/lib/bookings/reference'
import { validateCoupon } from '@/lib/coupons/validate'
import { getStripe, StripeNotConfiguredError } from '@/lib/stripe/client'
import { serverUrl, holdDurationMinutes, isStripeConfigured, turnstileSecretKey, isTurnstileConfigured } from '@/lib/env'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * POST /api/checkout -- per ADR-004's exact API contract.
 *
 * 1. Re-validates the hold (must exist, belong to this session/event,
 *    not expired) and re-checks availability (defence-in-depth on top
 *    of the hold itself -- ADR-002).
 * 2. Optionally validates + prices a coupon (ADR-005 preview logic;
 *    the coupon is NOT consumed here -- consumption happens in the
 *    webhook, see src/lib/bookings/finalize.ts).
 * 3. Verifies the Cloudflare Turnstile token (ADR-008 C16) if
 *    configured. Degrades gracefully with a clear warning if keys
 *    are unset — same pattern as Stripe graceful degradation.
 * 4. If Stripe is not configured (STRIPE_SECRET_KEY unset), returns a
 *    clear 503 "payments not yet configured" response BEFORE creating
 *    the booking, so no orphaned pending row is left behind.
 * 5. Creates the booking with status: 'pending'.
 * 6. Creates a Stripe Checkout Session with client_reference_id =
 *    booking.id and the metadata contract ADR-004 specifies, plus
 *    sessionId (used later by the webhook to locate + delete the
 *    correct seat_hold).
 * 7. Returns { url } for the frontend to redirect to.
 *
 * @compliance ADR-008 C11 (rate limiting on booking endpoint).
 * @compliance ADR-008 C16 (bot mitigation via Cloudflare Turnstile).
 */

// 60 s window, 10 req/min per IP. Each successful call creates a pending
// booking row + a Stripe Checkout Session (both expensive), so the limit is
// intentionally tighter than holds/coupons. A legitimate user retries only
// on a transient Stripe error; 10/min comfortably covers that while
// throttling scripted checkout spam.
const rateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 })

/**
 * Verify a Cloudflare Turnstile token server-side.
 * Returns true if the token is valid; false otherwise.
 *
 * When Turnstile is not configured (secret key absent), the caller should
 * skip this check entirely — see isTurnstileConfigured().
 */
async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secret = turnstileSecretKey()
  if (!secret) {
    console.warn('[checkout] Turnstile secret key is unset — skipping bot verification. Set TURNSTILE_SECRET_KEY to enable.')
    return true // degrade gracefully
  }

  try {
    const formData = new URLSearchParams()
    formData.append('secret', secret)
    formData.append('response', token)

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      console.warn('[checkout] Turnstile siteverify returned non-200:', res.status)
      return false
    }

    const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] }
    if (!data.success) {
      console.warn('[checkout] Turnstile verification failed:', data['error-codes'])
    }
    return data.success
  } catch (err) {
    console.error('[checkout] Turnstile siteverify network error:', err)
    return false
  }
}

export async function POST(req: NextRequest) {
  rateLimiter.maybeCleanup()

  const ip = getClientIp(req)
  if (!rateLimiter.check(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 })
  }
  const input = parsed.data

  // --- Turnstile bot mitigation (ADR-008 C16) ---
  // Graceful degradation: if keys are not configured, skip verification
  // and log a clear warning (same pattern as Stripe graceful degradation).
  if (isTurnstileConfigured()) {
    if (!input.turnstileToken) {
      return NextResponse.json({ error: 'bot_check_required' }, { status: 400 })
    }
    const verified = await verifyTurnstileToken(input.turnstileToken)
    if (!verified) {
      return NextResponse.json({ error: 'bot_check_failed' }, { status: 400 })
    }
  } else {
    console.warn(
      '[checkout] Turnstile is not configured (TURNSTILE_SECRET_KEY / NEXT_PUBLIC_TURNSTILE_SITE_KEY are unset). ' +
        'Bot mitigation is DISABLED — register a free Cloudflare Turnstile site and set both env vars to enable it. ' +
        'See .env.example for details.',
    )
  }

  const p = await payload()

  // 1. Re-validate the hold.
  const hold = await getSeatHold(input.holdId)
  if (!hold) {
    return NextResponse.json({ error: 'hold_not_found_or_expired' }, { status: 409 })
  }
  if (String(hold.event) !== String(input.eventId) || hold.sessionId !== input.sessionId) {
    return NextResponse.json({ error: 'hold_mismatch' }, { status: 409 })
  }
  if (new Date(hold.expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'hold_expired' }, { status: 409 })
  }
  if (hold.seats !== input.seats) {
    return NextResponse.json({ error: 'seats_mismatch' }, { status: 409 })
  }

  const event = await p.findByID({ collection: 'events', id: input.eventId, overrideAccess: true }).catch(() => null)
  if (!event) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }
  const ev = event as {
    id: string | number
    title: string
    pricePerPerson: number
    service: string | number | { id: string | number }
    status: string
  }
  if (ev.status !== 'scheduled') {
    return NextResponse.json({ error: 'event_not_bookable' }, { status: 409 })
  }

  // Defence-in-depth availability re-check (the hold already reserved the
  // seats, but guard against a corrupted/duplicated hold state).
  const availability = await getAvailability(input.eventId)
  if (availability.status === 'fully_booked' && availability.remaining < 0) {
    return NextResponse.json({ error: 'insufficient_seats' }, { status: 409 })
  }

  const serviceId = typeof ev.service === 'object' ? ev.service.id : ev.service
  const totalBeforeDiscount = ev.pricePerPerson * input.seats
  let totalAmount = totalBeforeDiscount
  let couponId: string | number | undefined

  // 2. Coupon preview/validation (not consumed here -- ADR-005).
  if (input.couponCode) {
    const couponResult = await validateCoupon(input.couponCode, input.eventId, input.seats, ev.pricePerPerson, serviceId)
    if (!couponResult.ok) {
      return NextResponse.json({ error: 'invalid_coupon', reason: couponResult.error }, { status: 400 })
    }
    totalAmount = couponResult.totalAfterDiscount ?? totalBeforeDiscount
    couponId = couponResult.coupon?.id
  }

  // 3. Stripe not configured -> graceful degradation BEFORE creating a booking.
  // Creating a pending booking and then returning 503 would leave an orphaned
  // row with no path to confirmation (no Stripe session to associate).  Return
  // early so the caller can still re-submit once keys are provisioned.
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: 'payments_not_configured',
        message:
          'Online payment is being finalised and is not yet available. Please try again shortly, or contact us to complete your booking manually.',
      },
      { status: 503 },
    )
  }

  // 4. Create the booking (status: pending).
  const reference = generateBookingReference()
  const booking = await p.create({
    collection: 'bookings',
    data: {
      reference,
      event: input.eventId,
      leadAttendeeName: input.leadAttendeeName,
      email: input.email,
      phone: input.phone,
      persons: input.seats,
      status: 'pending',
      language: input.language,
      coupon: couponId,
      totalAmount,
      dietaryNotes: input.dietaryConsent ? input.dietaryNotes : undefined,
      dietaryConsent: Boolean(input.dietaryConsent && input.dietaryNotes),
    },
    overrideAccess: true,
  })
  const bookingId = (booking as { id: string | number }).id

  // 5. Create the Stripe Checkout Session.
  try {
    const stripe = getStripe()
    const amountInCents = Math.round(totalAmount * 100)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: String(bookingId),
      customer_email: input.email,
      metadata: {
        bookingId: String(bookingId),
        eventId: String(input.eventId),
        seats: String(input.seats),
        email: input.email,
        sessionId: input.sessionId,
      },
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: Math.max(0, amountInCents),
            product_data: {
              name: ev.title,
              description: `${input.seats} seat${input.seats === 1 ? '' : 's'} -- Malta Food Experience`,
            },
          },
          quantity: 1,
        },
      ],
      // Match Checkout Session expiry to the seat-hold TTL (ADR-004 negative
      // consequence: "MFA should configure session expiry at 15 minutes to
      // match the seat hold"). Stripe requires >= 30 minutes minimum.
      expires_at: Math.floor(Date.now() / 1000) + Math.max(30 * 60, holdDurationMinutes() * 60),
      success_url: `${serverUrl()}/booking/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${serverUrl()}/booking/cancel?session_id={CHECKOUT_SESSION_ID}`,
    })

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: 'payments_not_configured', reference }, { status: 503 })
    }
    console.error('[checkout] Stripe session creation failed:', err)
    // Release the hold so the seats aren't stuck reserved for a checkout
    // that never happened.
    await releaseSeatHold(hold.id).catch(() => undefined)
    await p
      .update({ collection: 'bookings', id: bookingId, data: { status: 'cancelled' }, overrideAccess: true })
      .catch(() => undefined)
    return NextResponse.json({ error: 'stripe_error' }, { status: 502 })
  }
}
