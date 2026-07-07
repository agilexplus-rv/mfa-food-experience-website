import { NextRequest, NextResponse } from 'next/server'

import { getStripe, StripeNotConfiguredError } from '@/lib/stripe/client'
import { isStripeWebhookConfigured } from '@/lib/env'
import { finalizeBookingFromStripeSession } from '@/lib/bookings/finalize'

/**
 * POST /api/webhooks/stripe -- per ADR-004 step 3 / C7.
 *
 * - Verifies the Stripe-Signature header against STRIPE_WEBHOOK_SECRET
 *   (never trusts an unverified payload).
 * - Handles `checkout.session.completed` idempotently (delegated to
 *   finalizeBookingFromStripeSession, which checks booking.status ===
 *   'pending' before doing anything).
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
      // Return 200 anyway for reasons that are permanent (not found /
      // missing metadata) to stop Stripe retrying forever; for transient
      // reasons we could return 500 to trigger a retry, but per ADR-004's
      // idempotent design + this being a defence-in-depth capacity check,
      // treating it as terminal here is safer than silently retrying into
      // an oversold event.
      return NextResponse.json({ received: true, warning: result.reason }, { status: 200 })
    }
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
