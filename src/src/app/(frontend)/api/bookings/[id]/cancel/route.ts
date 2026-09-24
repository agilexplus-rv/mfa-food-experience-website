import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { getStripe, StripeNotConfiguredError } from '@/lib/stripe/client'
import { isStripeConfigured } from '@/lib/env'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

async function getAuthUser(
  req: NextRequest,
  p: Payload,
): Promise<{ id: string | number; role: string } | null> {
  const user = await verifySession(req, p)
  if (!user) return null
  return { id: user.id, role: user.role }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const p = await payload()

  const currentUser = await getAuthUser(req, p)
  if (!currentUser) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const booking = await p
    .findByID({ collection: 'bookings', id, overrideAccess: true, depth: 1 })
    .catch(() => null)

  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const b = booking as {
    id: string | number
    reference: string
    status: string
    event: string | number | { id: string | number }
    persons: number
    stripePaymentIntentId?: string | null
    stripeRefundId?: string | null
  }

  if (b.status === 'cancelled') {
    return NextResponse.json(
      { error: 'already_cancelled', reference: b.reference },
      { status: 409 },
    )
  }

  // --- Stripe refund ---
  let refundResult: { refundId?: string; refundStatus?: string } = {}

  if (b.stripePaymentIntentId && isStripeConfigured()) {
    try {
      const stripe = getStripe()
      // Check for existing refund on this payment intent
      const existingRefunds = await stripe.refunds.list({
        payment_intent: b.stripePaymentIntentId,
        limit: 5,
      })
      const alreadyRefunded = existingRefunds.data.find(
        (r) => r.status === 'succeeded' || r.status === 'pending',
      )
      if (alreadyRefunded) {
        refundResult = { refundId: alreadyRefunded.id, refundStatus: alreadyRefunded.status ?? 'unknown' }
      } else {
        const refund = await stripe.refunds.create({
          payment_intent: b.stripePaymentIntentId,
        })
        refundResult = { refundId: refund.id, refundStatus: refund.status ?? 'unknown' }
      }
    } catch (err) {
      if (err instanceof StripeNotConfiguredError) {
        // Graceful degrade: no Stripe keys configured
        console.warn('[cancel] Stripe not configured, skipping refund for booking', b.reference)
      } else {
        console.error('[cancel] Stripe refund failed for booking', b.reference, err)
        return NextResponse.json(
          { error: 'refund_failed', message: 'Cancellation aborted: refund could not be processed.' },
          { status: 500 },
        )
      }
    }
  } else if (isStripeConfigured() && !b.stripePaymentIntentId) {
    // Payment was never completed (no PaymentIntent) — still allow cancellation
    console.info('[cancel] No PaymentIntent on booking', b.reference, '— skipping refund, cancelling directly')
  }

  // Mark booking as cancelled
  await p.update({
    collection: 'bookings',
    id,
    data: {
      status: 'cancelled',
      ...(refundResult.refundId
        ? { stripeRefundId: refundResult.refundId, refundStatus: refundResult.refundStatus }
        : {}),
    },
    overrideAccess: true,
  })

  // --- Free seat holds for this event+booking ---
  const eventId = typeof b.event === 'object' ? b.event.id : b.event
  try {
    const holds = await p.find({
      collection: 'seat_holds',
      where: { event: { equals: eventId } },
      limit: 50,
      overrideAccess: true,
    })
    for (const h of holds.docs as { id: string | number; seats: number }[]) {
      await p.delete({ collection: 'seat_holds', id: h.id, overrideAccess: true }).catch(() => undefined)
    }
  } catch (err) {
    console.warn('[cancel] Failed to clean up seat holds for event', eventId, err)
  }

  // --- Waitlist notification ---
  try {
    const waitlistEntry = await p.find({
      collection: 'waitlist',
      where: {
        and: [
          { event: { equals: eventId } },
          { status: { equals: 'waiting' } },
        ],
      },
      sort: 'createdAt',
      limit: 1,
      overrideAccess: true,
    })

    if (waitlistEntry.docs.length > 0) {
      const entry = waitlistEntry.docs[0] as unknown as {
        id: string | number
        email: string
        name: string
        event: string | number
      }
      const eventDoc = await p.findByID({
        collection: 'events',
        id: eventId,
        overrideAccess: true,
      }).catch(() => null)
      const eventTitle = (eventDoc as { title?: string } | null)?.title ?? 'the event'

      // Send notification email
      try {
        await p.sendEmail({
          to: entry.email,
          subject: `Seats available — ${eventTitle}`,
          html: `<p>Hello ${entry.name},</p>
<p>Good news! Seats are now available for <strong>${eventTitle}</strong>.</p>
<p>Please visit the Malta Food Experience website to book your spot.</p>
<p>— Malta Food Experience</p>`,
        })
      } catch (emailErr) {
        console.warn('[cancel/waitlist] Failed to send waitlist notification email:', emailErr)
      }

      // Mark entry as notified
      await p.update({
        collection: 'waitlist',
        id: entry.id,
        data: { status: 'notified', notifiedAt: new Date().toISOString() },
        overrideAccess: true,
      })
    }
  } catch (err) {
    console.warn('[cancel/waitlist] Waitlist notification check failed:', err)
  }

  // --- Audit log ---
  let body: unknown
  let reason: string | undefined
  try {
    body = await req.json()
    reason =
      typeof (body as Record<string, unknown>)?.reason === 'string'
        ? (body as { reason: string }).reason
        : undefined
  } catch { /* no body */ }

  await p.create({
    collection: 'audit_logs',
    data: {
      action: 'update',
      actor: currentUser.id as string,
      collection: 'bookings',
      documentId: String(id),
      detail: `Cancelled ${b.reference}${reason ? `: ${reason}` : ''}${refundResult.refundId ? ` (refund: ${refundResult.refundId}, status: ${refundResult.refundStatus})` : ''}`,
    },
    overrideAccess: true,
  })

  return NextResponse.json({
    ok: true,
    reference: b.reference,
    status: 'cancelled',
    refund: refundResult.refundId
      ? { id: refundResult.refundId, status: refundResult.refundStatus }
      : null,
  })
}
