import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { getAvailability } from '@/lib/availability'
import { generateQrToken, hashQrToken } from '@/lib/qr/token'
import { sendConfirmationEmail } from '@/lib/email/send-confirmation'
import { incrementCouponUseCount, transitionBookingStatus } from '@/lib/db/atomic'

/**
 * Webhook-driven booking finalisation per ADR-004 step 3, combined
 * with ADR-005's coupon atomicity transaction.
 *
 * === Atomicity model (documented per task requirement) ===
 * ADR-004 and ADR-005 both specify a single SERIALIZABLE database
 * transaction spanning: pending-status check -> capacity re-check ->
 * booking confirmation -> seat-hold deletion -> QR token issuance ->
 * (if a coupon was used) coupon use-count increment + redemption
 * insert. Payload's Local API does not expose a way to open one raw
 * transaction spanning several `payload.create`/`update`/`delete` calls
 * that works identically against the sqlite adapter (Turso demo) and
 * the postgres adapter (production, ADR-001).
 *
 * Instead, the two steps that actually decide correctness under
 * concurrency are single conditional UPDATE statements issued straight
 * to the database (src/lib/db/atomic.ts), so the DB -- not a JS
 * read-then-branch -- picks the winner:
 *
 *   1. Defence-in-depth capacity re-check (read-only).
 *   2. CLAIM: `UPDATE bookings SET status='confirmed' WHERE id=? AND
 *      status='pending'`. Exactly one of any number of concurrent
 *      webhook deliveries (or a racing deadline-cancel) succeeds; every
 *      other caller sees 0 rows and returns idempotently. This replaces
 *      the earlier "read status, then update" check, which two
 *      simultaneous deliveries could both pass -- producing a double
 *      coupon increment and two confirmation emails with different QR
 *      tokens (only the last-written hash would scan).
 *   3. Coupon accounting, run only by the claimer: an idempotency check
 *      on coupon_redemptions (unique on booking), then
 *      `UPDATE coupons SET use_count = use_count + 1 WHERE ... AND
 *      use_count < max_total_uses` -- the ADR's SELECT ... FOR UPDATE
 *      equivalent. The previous `update({ useCount: c.useCount + 1 })`
 *      was NOT a single atomic statement: Payload reads the doc, merges,
 *      and writes the JS-computed value, so concurrent finalisations of
 *      two bookings with the same coupon lost an increment.
 *      NOTE (deliberate change from the old ordering): payment has
 *      already been captured by the time the webhook fires, so an
 *      exhausted/missing coupon no longer blocks confirmation -- the
 *      booking is honoured and the anomaly is logged for the admin.
 *      Refusing left a paid customer 'pending' until the deadline
 *      sweep cancelled them.
 *   4. QR token hash + payment references are written, the seat_hold
 *      for this session/event is deleted, and the confirmation email is
 *      sent last (best-effort, never reverts the booking).
 *
 * Residual (documented) gap: if the process dies between step 2 and
 * step 4 the booking is 'confirmed' without a QR hash / transaction id.
 * It is visible in the console and recoverable with "resend
 * confirmation" (which issues a fresh token). A retried webhook is a
 * safe no-op because the claim already succeeded.
 */

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

export interface FinalizeBookingResult {
  ok: boolean
  alreadyConfirmed?: boolean
  reason?: string
}

// ── Stripe finalisation (legacy — kept for existing bookings) ──────

export async function finalizeBookingFromStripeSession(session: {
  id: string
  payment_intent?: string | { id: string } | null
  metadata?: Record<string, string> | null
  amount_total?: number | null
}): Promise<FinalizeBookingResult> {
  const bookingId = session.metadata?.bookingId
  if (!bookingId) return { ok: false, reason: 'missing_booking_id_in_metadata' }

  const booking = await loadAndCheckBooking(bookingId)
  if (!booking) return { ok: false, reason: 'booking_not_found' }
  if (booking.status !== 'pending') return { ok: true, alreadyConfirmed: true }

  const paymentIntentId =
    typeof session.payment_intent === 'object' ? session.payment_intent?.id : session.payment_intent

  return finalizeCore({
    booking,
    sessionId: session.metadata?.sessionId,
    paymentUpdates: {
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId ?? undefined,
      paymentMethod: 'stripe',
    },
  })
}

// ── VIVA finalisation ──────────────────────────────────────────────

/**
 * VIVA reports amounts in the currency's major unit (e.g. 30.00 for
 * EUR 30) on the Retrieve Transaction API and in webhook EventData,
 * while Create Order takes integer cents. Set VIVA_AMOUNT_IN_CENTS=true
 * if the account's API responses turn out to use minor units instead --
 * a mismatch fails CLOSED (booking stays pending, loud log), never open.
 */
function vivaAmountToCents(amount: number): number {
  return process.env.VIVA_AMOUNT_IN_CENTS === 'true' ? Math.round(amount) : Math.round(amount * 100)
}

/**
 * All `input` fields MUST come from the API-verified transaction
 * (getTransaction), never from the webhook body: in demo mode the body
 * is unauthenticated, and even in production the body is only as
 * trustworthy as the shared secret.
 */
export async function finalizeBookingFromVivaTransaction(input: {
  orderCode: string
  transactionId: string
  amount: number
  merchantTrns?: string
}): Promise<FinalizeBookingResult> {
  const p = await payload()

  let booking: BookingRecord | null = null

  // Resolve the booking by the OrderCode the checkout stored on it.
  const byOrderCode = await p.find({
    collection: 'bookings',
    where: { vivaOrderCode: { equals: input.orderCode } },
    limit: 1,
    overrideAccess: true,
  })
  if (byOrderCode.docs.length > 0) {
    booking = await loadAndCheckBooking(byOrderCode.docs[0]!.id)
  }

  // Fallback: the checkout stores the OrderCode in a second write after
  // creating the VIVA order; if that write failed we can still match on
  // merchantTrns (our booking reference) -- but only for a booking that
  // has NO OrderCode of its own. A booking bound to a different order
  // must never be confirmed by this transaction.
  if (!booking && input.merchantTrns) {
    const byRef = await p.find({
      collection: 'bookings',
      where: { reference: { equals: input.merchantTrns } },
      limit: 1,
      overrideAccess: true,
    })
    if (byRef.docs.length > 0) {
      const candidate = await loadAndCheckBooking(byRef.docs[0]!.id)
      if (candidate && candidate.vivaOrderCode && candidate.vivaOrderCode !== input.orderCode) {
        console.error('[finalize/viva] OrderCode mismatch for reference', input.merchantTrns, {
          bookingOrderCode: candidate.vivaOrderCode,
          transactionOrderCode: input.orderCode,
          transactionId: input.transactionId,
        })
        return { ok: false, reason: 'order_code_mismatch' }
      }
      booking = candidate
    }
  }

  if (!booking) return { ok: false, reason: 'booking_not_found' }

  // Amount re-verification (ADR-004 C7): the transaction must pay for
  // exactly what the booking costs. Without this, one cheap real
  // transaction could confirm any pending booking.
  const expectedCents = Math.round(booking.totalAmount * 100)
  const paidCents = vivaAmountToCents(input.amount)
  if (paidCents !== expectedCents) {
    console.error('[finalize/viva] Amount mismatch -- NOT confirming', {
      reference: booking.reference,
      expectedCents,
      paidRaw: input.amount,
      paidCents,
      transactionId: input.transactionId,
    })
    return { ok: false, reason: 'amount_mismatch' }
  }

  // A transaction pays for one booking only (replay of a real
  // TransactionId against a different OrderCode/booking).
  const reused = await p.find({
    collection: 'bookings',
    where: {
      and: [{ vivaTransactionId: { equals: input.transactionId } }, { id: { not_equals: booking.id } }],
    },
    limit: 1,
    overrideAccess: true,
  })
  if (reused.docs.length > 0) {
    console.error('[finalize/viva] TransactionId already used by another booking', {
      transactionId: input.transactionId,
      otherBookingId: reused.docs[0]!.id,
      reference: booking.reference,
    })
    return { ok: false, reason: 'transaction_already_used' }
  }

  if (booking.status !== 'pending') {
    if (booking.status === 'cancelled') {
      // The deadline sweep (cancel page) won a race against this payment,
      // or the customer paid after the booking was cancelled. Money has
      // been taken: record the transaction so the admin refund path
      // (which needs vivaTransactionId) works, and shout.
      console.error('[finalize/viva] Payment received for a CANCELLED booking -- refund required', {
        reference: booking.reference,
        transactionId: input.transactionId,
        orderCode: input.orderCode,
      })
      await p
        .update({
          collection: 'bookings',
          id: booking.id,
          data: { vivaTransactionId: input.transactionId, vivaOrderCode: input.orderCode },
          overrideAccess: true,
        })
        .catch((err) => console.error('[finalize/viva] Failed to record transaction on cancelled booking:', err))
      return { ok: false, reason: 'paid_after_cancellation' }
    }
    if (booking.vivaTransactionId && booking.vivaTransactionId !== input.transactionId) {
      console.error('[finalize/viva] Second payment for an already-confirmed booking -- refund required', {
        reference: booking.reference,
        existingTransactionId: booking.vivaTransactionId,
        newTransactionId: input.transactionId,
      })
      return { ok: false, reason: 'duplicate_payment_for_confirmed_booking' }
    }
    // Same transaction delivered again: idempotent no-op.
    return { ok: true, alreadyConfirmed: true }
  }

  // Payment deadline: the customer has PAID, so a late webhook must never
  // cancel the booking (the seats are still reserved by the pending row).
  // Only unpaid bookings are expired, by the cancel page / sweep, via an
  // atomic pending->cancelled transition that this finalisation's own
  // pending->confirmed claim races safely against.
  if (booking.paymentDeadline && Date.now() > new Date(booking.paymentDeadline).getTime()) {
    console.warn('[finalize/viva] Payment confirmed after the payment deadline; honouring it', {
      reference: booking.reference,
      deadline: booking.paymentDeadline,
    })
  }

  return finalizeCore({
    booking,
    paymentUpdates: {
      vivaOrderCode: input.orderCode,
      vivaTransactionId: input.transactionId,
      paymentMethod: 'viva',
    },
  })
}

// ── Shared core ────────────────────────────────────────────────────

interface FinalizeCoreInput {
  booking: BookingRecord
  sessionId?: string
  paymentUpdates: Record<string, unknown>
}

async function finalizeCore(input: FinalizeCoreInput): Promise<FinalizeBookingResult> {
  const { booking: b, sessionId, paymentUpdates } = input
  const p = await payload()

  const eventId = typeof b.event === 'object' ? b.event.id : b.event

  // 1. Defence-in-depth capacity re-check. With insert-then-verify in
  //    /api/holds and /api/checkout this should never trigger; if it
  //    does, a human must resolve it (the customer has paid).
  const availability = await getAvailability(eventId)
  const eventDoc = await p.findByID({ collection: 'events', id: eventId, overrideAccess: true }).catch(() => null)
  const capacity = (eventDoc as { capacity?: number } | null)?.capacity ?? 0
  if (availability.booked > capacity) {
    console.error('[finalize] Capacity exceeded at confirmation -- manual action required', {
      reference: b.reference,
      booked: availability.booked,
      capacity,
      paymentUpdates,
    })
    return { ok: false, reason: 'capacity_exceeded_defence_in_depth' }
  }

  // 2. Atomic claim: pending -> confirmed. Loser(s) return idempotently.
  const claimed = await transitionBookingStatus(p, b.id, 'pending', 'confirmed')
  if (!claimed) {
    const current = await loadAndCheckBooking(b.id)
    if (current?.status === 'cancelled') {
      console.error('[finalize] Booking was cancelled while its payment was being confirmed -- refund required', {
        reference: b.reference,
        paymentUpdates,
      })
      return { ok: false, reason: 'paid_after_cancellation' }
    }
    return { ok: true, alreadyConfirmed: true }
  }

  // 3. Coupon accounting (ADR-005), only ever executed by the claimer.
  if (b.coupon) {
    const couponId = typeof b.coupon === 'object' ? b.coupon.id : b.coupon
    try {
      const existingRedemption = await p.find({
        collection: 'coupon_redemptions',
        where: { and: [{ coupon: { equals: couponId } }, { booking: { equals: b.id } }] },
        limit: 1,
        overrideAccess: true,
      })
      if (existingRedemption.docs.length === 0) {
        const incremented = await incrementCouponUseCount(p, couponId)
        if (!incremented) {
          console.warn('[finalize] Coupon missing or exhausted at confirmation; booking honoured (payment captured)', {
            reference: b.reference,
            couponId,
          })
        }
        await p.create({
          collection: 'coupon_redemptions',
          data: { coupon: couponId, booking: b.id },
          overrideAccess: true,
        })
      }
    } catch (err) {
      // Never leave a paid, claimed booking half-finalised because of coupon bookkeeping.
      console.error('[finalize] Coupon accounting failed for', b.reference, err)
    }
  }

  // 4. Generate QR token (ADR-003) -- raw token only exists here + in the email --
  //    and persist the hash together with the payment references.
  const rawQrToken = generateQrToken()
  const qrTokenHash = hashQrToken(rawQrToken)

  await p.update({
    collection: 'bookings',
    id: b.id,
    data: {
      qrTokenHash,
      ...paymentUpdates,
    },
    overrideAccess: true,
  })

  // 5. Delete the seat_hold for this booking's session+event.
  const holds = await p.find({
    collection: 'seat_holds',
    where: { event: { equals: eventId } },
    limit: 50,
    overrideAccess: true,
  })
  for (const h of holds.docs as { id: string | number; sessionId?: string }[]) {
    if (sessionId && h.sessionId === sessionId) {
      await p.delete({ collection: 'seat_holds', id: h.id, overrideAccess: true }).catch(() => undefined)
    }
  }

  // 6. Confirmation email (best-effort).
  const eventInfo = eventDoc as {
    title: string
    date: string
    startTime: string
    endTime: string
    locationRef: string
  } | null
  if (eventInfo) {
    const dateStr = new Date(eventInfo.date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-MT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const fmt = new Intl.DateTimeFormat('en-MT', { hour: 'numeric', minute: '2-digit', hour12: false })
    const timeRange = `${fmt.format(new Date(eventInfo.startTime))} - ${fmt.format(new Date(eventInfo.endTime))}`

    await sendConfirmationEmail({
      toEmail: b.email,
      reference: b.reference,
      eventTitle: eventInfo.title,
      eventDate: dateStr,
      eventTimeRange: timeRange,
      locationRef: eventInfo.locationRef,
      persons: b.persons,
      totalAmount: b.totalAmount,
      language: b.language ?? 'en',
      rawQrToken,
    })
  }

  // 7. Low-capacity alert.
  const adminAlertEmail = process.env.ADMIN_ALERT_EMAIL
  if (adminAlertEmail) {
    const afterAvailability = await getAvailability(eventId)
    if (afterAvailability.remaining <= 2) {
      const statusLabel = afterAvailability.remaining <= 0 ? 'FULLY BOOKED' : `${afterAvailability.remaining} seat(s) remaining`
      try {
        await p.sendEmail({
          to: adminAlertEmail,
          subject: `[MFA Alert] ${eventInfo?.title ?? 'Event'}: ${statusLabel}`,
          html: `<p><strong>${eventInfo?.title ?? 'Event'}</strong>: ${statusLabel}</p>
<p>Capacity: ${capacity} | Booked: ${afterAvailability.booked} | Holds: ${afterAvailability.holds}</p>
<p>Booking reference: ${b.reference}</p>
<p>This is an automated alert from Malta Food Experience.</p>`,
        })
      } catch (emailEr) {
        console.warn('[finalize/alert] Failed to send admin alert email:', emailEr)
      }
    }
  }

  return { ok: true }
}

// ── Helpers ───────────────────────────────────────────────────────────

type BookingRecord = {
  id: string | number
  reference: string
  status: string
  event: string | number | { id: string | number }
  persons: number
  email: string
  leadAttendeeName: string
  language: 'en' | 'mt'
  coupon?: string | number | { id: string | number } | null
  totalAmount: number
  vivaOrderCode?: string | null
  vivaTransactionId?: string | null
  paymentDeadline?: string | null
}

async function loadAndCheckBooking(bookingId: string | number): Promise<BookingRecord | null> {
  const p = await payload()
  const booking = await p.findByID({ collection: 'bookings', id: bookingId, overrideAccess: true }).catch(() => null)
  if (!booking) return null
  return booking as unknown as BookingRecord
}
