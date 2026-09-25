import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { checkoutSchema } from '@/lib/validations/booking'
import { getAvailability } from '@/lib/availability'
import { getSeatHold, releaseSeatHold } from '@/lib/bookings/seat-holds'
import { generateBookingReference } from '@/lib/bookings/reference'
import { validateCoupon } from '@/lib/coupons/validate'
import { createOrder, checkoutRedirectUrl, VivaNotConfiguredError } from '@/lib/viva/client'
import { serverUrl, holdDurationMinutes, isVivaConfigured, vivaSourceCode, turnstileSecretKey, isTurnstileConfigured } from '@/lib/env'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * POST /api/checkout — VIVA Smart Checkout (replaces Stripe, ADR-004 pattern).
 *
 * 1. Re-validates the hold and re-checks availability.
 * 2. Optionally validates + prices a coupon.
 * 3. Verifies Cloudflare Turnstile token if configured.
 * 4. Creates the booking with status: 'pending'.
 * 5. Creates a VIVA payment order → OrderCode.
 * 6. Returns { url } for the frontend to redirect to vivapayments.com/web/checkout.
 *
 * VIVA success/cancel URLs are configured per payment source in the VIVA banking
 * app, not per-order. VIVA appends ?t={TransactionId}&s={OrderCode} to both.
 */

const rateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 })

async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secret = turnstileSecretKey()
  if (!secret) {
    console.warn('[checkout] Turnstile secret key is unset — skipping bot verification.')
    return true
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
      return false
    }
    return true
  } catch (err) {
    console.error('[checkout] Turnstile siteverify error:', err)
    return false
  }
}

export async function POST(req: NextRequest) {
  // ── Rate limit ──
  const ip = getClientIp(req)
  if (!rateLimiter.check(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  rateLimiter.maybeCleanup()

  // ── Parse + validate ──
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 422 })
  }

  const { eventId, seats: persons, holdId, leadAttendeeName, email, phone, dietaryNotes, dietaryConsent, couponCode, turnstileToken, language } = parsed.data

  // ── Turnstile ──
  if (isTurnstileConfigured()) {
    if (!turnstileToken) {
      return NextResponse.json({ error: 'turnstile_required' }, { status: 400 })
    }
    const ok = await verifyTurnstileToken(turnstileToken)
    if (!ok) {
      return NextResponse.json({ error: 'turnstile_failed' }, { status: 400 })
    }
  }

  // ── Re-validate hold ──
  const hold = await getSeatHold(holdId)
  if (!hold || hold.event !== eventId || hold.sessionId !== parsed.data.sessionId) {
    return NextResponse.json({ error: 'hold_not_found_or_expired' }, { status: 409 })
  }
  if (hold.seats !== persons) {
    return NextResponse.json({ error: 'hold_mismatch' }, { status: 409 })
  }
  const now = new Date()
  if (new Date(hold.expiresAt) <= now) {
    return NextResponse.json({ error: 'hold_expired' }, { status: 410 })
  }

  // ── Re-check availability ──
  const availability = await getAvailability(eventId)
  if (availability.remaining < persons) {
    return NextResponse.json({ error: 'insufficient_seats', remaining: availability.remaining }, { status: 409 })
  }

  // ── Guard: VIVA must be configured ──
  if (!isVivaConfigured()) {
    return NextResponse.json(
      { error: 'payments_not_configured', message: 'VIVA Wallet is not configured (VIVA_CLIENT_ID / VIVA_CLIENT_SECRET unset).' },
      { status: 503 },
    )
  }

  // ── Fetch event for pricing + metadata ──
  const p = await payload()
  const event = await p.findByID({ collection: 'events', id: eventId, overrideAccess: true }).catch(() => null)
  if (!event) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }

  const evt = event as {
    id: string | number
    title: string
    date: string
    startTime: string
    endTime: string
    pricePerPerson: number
    capacity: number
    locationRef: string
  }

  // ── Coupon validation (preview pricing only; not consumed yet) ──
  let couponId: string | number | null = null
  let discountAmountCents = 0
  let totalAmountCents = evt.pricePerPerson * persons

  if (couponCode) {
    const pricing = await (await import('@/lib/coupons/validate')).getEventPricingContext(eventId)
    if (pricing) {
      const { validateCoupon } = await import('@/lib/coupons/validate')
      const couponResult = await validateCoupon(
        couponCode,
        eventId,
        persons,
        pricing.pricePerPerson,
        pricing.serviceId,
      )

      if (couponResult.ok && couponResult.coupon) {
        couponId = couponResult.coupon.id
        discountAmountCents = couponResult.discountAmount ?? 0
        totalAmountCents = Math.max(0, couponResult.totalAfterDiscount ?? totalAmountCents)
      } else {
        return NextResponse.json({ error: 'invalid_coupon', reason: couponResult.error }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
    }
  }

  // ── Create booking (status: pending) ──
  const reference = generateBookingReference()
  const booking = await p.create({
    collection: 'bookings',
    data: {
      reference,
      event: eventId,
      leadAttendeeName,
      email,
      phone: phone ?? '',
      persons,
      status: 'pending',
      language: language ?? 'en',
      totalAmount: totalAmountCents,
      paymentMethod: 'viva',
      dietaryNotes: dietaryNotes ?? '',
      dietaryConsent: dietaryConsent ?? false,
      ...(couponId ? { coupon: couponId } : {}),
    },
    overrideAccess: true,
  })

  const bookingId = booking.id

  // ── Create VIVA payment order ──
  try {
    const sourceCode = vivaSourceCode()
    const result = await createOrder({
      amount: totalAmountCents,
      customerTrns: `${evt.title} — ${persons} seat${persons === 1 ? '' : 's'}`,
      customer: {
        email,
        fullName: leadAttendeeName,
        phone,
        countryCode: 'MT',
        requestLang: (language === 'mt' ? 'mt-MT' : 'en-GB'),
      },
      sourceCode,
      merchantTrns: reference,
      paymentTimeout: holdDurationMinutes() * 60,
      tags: ['mfa-food-experience', `event:${eventId}`, `booking:${bookingId}`],
      disableWallet: true, // Don't allow Viva Wallet payment method
    })

    // Store the OrderCode on the booking
    await p.update({
      collection: 'bookings',
      id: bookingId,
      data: { vivaOrderCode: String(result.orderCode) },
      overrideAccess: true,
    })

    const redirectUrl = `${checkoutRedirectUrl()}?ref=${result.orderCode}`

    return NextResponse.json({ url: redirectUrl }, { status: 200 })
  } catch (err) {
    if (err instanceof VivaNotConfiguredError) {
      return NextResponse.json({ error: 'payments_not_configured', reference }, { status: 503 })
    }
    console.error('[checkout] VIVA order creation failed:', err)
    // Release the hold so seats aren't stuck
    await releaseSeatHold(hold.id).catch(() => undefined)
    await p
      .update({ collection: 'bookings', id: bookingId, data: { status: 'cancelled' }, overrideAccess: true })
      .catch(() => undefined)
    return NextResponse.json({ error: 'payment_error' }, { status: 502 })
  }
}