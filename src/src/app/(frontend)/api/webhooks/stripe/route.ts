import { NextRequest, NextResponse } from 'next/server'

import { getStripe, StripeNotConfiguredError } from '@/lib/stripe/client'
import { isStripeWebhookConfigured } from '@/lib/env'
import { finalizeBookingFromStripeSession } from '@/lib/bookings/finalize'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * POST /api/webhooks/stripe -- per ADR-004 step 3 / C7.
 *
 * - Verifies the Stripe-Signature header against STRIPE_WEBHOOK_SECRET
 *   (never trusts an unverified payload).
 * - Handles `checkout.session.completed` idempotently (delegated to
 *   finalizeBookingFromStripeSession, which checks booking.status ===
 *   'pending' before doing anything).
 * - Handles `charge.refunded` to reconcile refund status if Stripe-initiated
 *   refunds happen outside the app (defence in depth), idempotent.
 * - Returns 200 for already-processed events (per ADR-004) so Stripe
 *   does not endlessly retry.
 *
 * If Stripe env vars are not yet configured, this route still exists
 * (no 404) but returns a clear 503 -- there is nothing to verify a
 * signature against without STRIPE_WEBHOOK_SECRET, and Stripe will not
 * be sending events here yet regardless (no webhook endpoint could
 * have been registered in the Stripe dashboard without the keys).
 */
export async function POST(req: NextRequest) {
  if (!isStripeWebhookConfigured()) {
    return NextResponse.json(
      { error: 'webhook_not_configured', message: 'STRIPE_WEBHOOK_SECRET is not set.' },
      { status: 503 },
    )
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 })
  }

  const rawBody = await req.text()

  let event: import('stripe').Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET as string)
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 })
    }
    console.error('[webhooks/stripe] Signature verification failed:', err)
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as import('stripe').Stripe.Checkout.Session
    const result = await finalizeBookingFromStripeSession({
      id: session.id,
      payment_intent: session.payment_intent,
      metadata: session.metadata,
      amount_total: session.amount_total,
    })
    if (!result.ok) {
      console.error('[webhooks/stripe] Booking finalisation failed:', result.reason)
      return NextResponse.json({ received: true, warning: result.reason }, { status: 200 })
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as import('stripe').Stripe.Charge
    const paymentIntentId = charge.payment_intent as string | undefined
    if (paymentIntentId) {
      const p = await payload()
      // Find booking by payment intent and update refund status
      const bookings = await p.find({
        collection: 'bookings',
        where: { stripePaymentIntentId: { equals: paymentIntentId } },
        limit: 1,
        overrideAccess: true,
      })
      if (bookings.docs.length > 0) {
        const booking = bookings.docs[0] as { id: string | number; reference: string }
        await p.update({
          collection: 'bookings',
          id: booking.id,
          data: {
            stripeRefundId: charge.id,
            refundStatus: charge.refunded ? 'succeeded' : 'none',
          },
          overrideAccess: true,
        })
        console.info('[webhooks/stripe] Refund reconciled for booking', booking.reference, 'refund:', charge.id)
      }
    }
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
