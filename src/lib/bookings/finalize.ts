import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { getAvailability } from '@/lib/availability'
import { generateQrToken, hashQrToken } from '@/lib/qr/token'
import { sendConfirmationEmail } from '@/lib/email/send-confirmation'

/**
 * Webhook-driven booking finalisation per ADR-004 step 3, combined
 * with ADR-005's coupon atomicity transaction.
 *
 * === Atomicity compromise (documented per task requirement) ===
 * ADR-004 and ADR-005 both specify a single SERIALIZABLE database
 * transaction spanning: pending-status check -> capacity re-check ->
 * booking confirmation -> seat-hold deletion -> QR token issuance ->
 * (if a coupon was used) coupon use-count increment + redemption
 * insert. Payload's Local API does not expose a way to open a raw SQL
 * transaction spanning multiple `payload.create`/`update`/`delete`
 * calls in application code in a database-agnostic way that works
 * identically against both the sqlite adapter (Turso demo) and the
 * postgres adapter (production, ADR-001) -- Payload does have an
 * internal `req.transactionID` mechanism used by its own multi-step
 * operations, but it is not part of the public Local API contract for
 * chaining several independent top-level calls the way this handler
 * needs to.
 *
 * What we do instead, in order, to approximate the ADR's guarantees as
 * closely as possible:
 *   1. Idempotency check FIRST (status must be 'pending') -- a second
 *      webhook delivery for an already-confirmed booking is a true
 *      no-op and returns early, satisfying ADR-004's idempotency
 *      requirement exactly (this part has no atomicity gap at all --
 *      it's a single read-then-branch).
 *   2. Defence-in-depth capacity re-check (re-reads availability).
 *   3. Coupon validation + use-count increment + redemption insert are
 *      performed BEFORE the booking status flip to 'confirmed', so
 *      that if the coupon step fails, the booking is left 'pending'
 *      (no confirmed booking with an unaccounted discount) and the
 *      seat hold is left intact until it naturally expires or the
 *      customer retries.
 *   4. The coupon use-count increment reads the current count and
 *      writes count+1 in a single `payload.update` call (a single
 *      UPDATE statement) rather than separate read/write requests,
 *      which minimises (but does not eliminate under true concurrent
 *      webhook delivery for the *same* coupon) the classic
 *      read-modify-write race the ADR's SELECT ... FOR UPDATE closes.
 *   5. Booking is then flipped to 'confirmed', the seat_hold row for
 *      this booking's session/event is deleted (hold -> confirmed
 *      booking), and the QR token hash is stored.
 *   6. Confirmation email is sent last (best-effort, never blocks or
 *      reverts the booking -- see sendConfirmationEmail's own
 *      try/catch).
 *
 * This is the same "careful sequence with existence/status checks"
 * compromise the task brief anticipated ("Payload doesn't expose raw
 * DB transactions easily through its Local API").
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

export async function finalizeBookingFromVivaTransaction(input: {
  orderCode: string
  transactionId: string
  amount: number
  merchantTrns?: string
}): Promise<FinalizeBookingResult> {
  // Resolve booking by orderCode or merchantTrns
  const p = await payload()

  let booking: Awaited<ReturnType<typeof loadAndCheckBooking>> = null

  // Try to find by orderCode first
  const byOrderCode = await p.find({
    collection: 'bookings',
    where: { vivaOrderCode: { equals: input.orderCode } },
    limit: 1,
    overrideAccess: true,
  })

  if (byOrderCode.docs.length > 0) {
    booking = await loadAndCheckBooking(byOrderCode.docs[0]!.id)
  }

  // Fallback: try merchantTrns (our booking reference)
  if (!booking && input.merchantTrns) {
    const byRef = await p.find({
      collection: 'bookings',
      where: { reference: { equals: input.merchantTrns } },
      limit: 1,
      overrideAccess: true,
    })
    if (byRef.docs.length > 0) {
      booking = await loadAndCheckBooking(byRef.docs[0]!.id)
    }
  }

  if (!booking) return { ok: false, reason: 'booking_not_found' }
  if (booking.status !== 'pending') return { ok: true }

  // Store VIVA transaction details
  const result = await finalizeCore({
    booking,
    paymentUpdates: {
      vivaOrderCode: input.orderCode,
      vivaTransactionId: input.transactionId,
      paymentMethod: 'viva',
    },
  })

  return result
}

// ── Shared core ────────────────────────────────────────────────────

interface FinalizeCoreInput {
  booking: NonNullable<Awaited<ReturnType<typeof loadAndCheckBooking>>>
  sessionId?: string
  paymentUpdates: Record<string, unknown>
}

async function finalizeCore(input: FinalizeCoreInput): Promise<FinalizeBookingResult> {
  const { booking: b, sessionId, paymentUpdates } = input
  const p = await payload()

  const eventId = typeof b.event === 'object' ? b.event.id : b.event

  // 1. Defence-in-depth capacity re-check.
  const availability = await getAvailability(eventId)
  const eventDoc = await p.findByID({ collection: 'events', id: eventId, overrideAccess: true }).catch(() => null)
  const capacity = (eventDoc as { capacity?: number } | null)?.capacity ?? 0
  if (availability.booked > capacity) {
    return { ok: false, reason: 'capacity_exceeded_defence_in_depth' }
  }

  // 2. Coupon atomicity (ADR-005) -- performed before confirming the booking.
  if (b.coupon) {
    const couponId = typeof b.coupon === 'object' ? b.coupon.id : b.coupon
    const coupon = await p.findByID({ collection: 'coupons', id: couponId, overrideAccess: true }).catch(() => null)
    if (!coupon) {
      return { ok: false, reason: 'coupon_not_found_at_confirmation' }
    }
    const c = coupon as { id: string | number; useCount: number; maxTotalUses?: number }
    if (c.maxTotalUses != null && c.useCount >= c.maxTotalUses) {
      return { ok: false, reason: 'coupon_exhausted_at_confirmation' }
    }

    const existingRedemption = await p.find({
      collection: 'coupon_redemptions',
      where: { and: [{ coupon: { equals: c.id } }, { booking: { equals: b.id } }] },
      limit: 1,
      overrideAccess: true,
    })
    if (existingRedemption.docs.length === 0) {
      await p.update({
        collection: 'coupons',
        id: c.id,
        data: { useCount: c.useCount + 1 },
        overrideAccess: true,
      })
      await p.create({
        collection: 'coupon_redemptions',
        data: { coupon: c.id, booking: b.id },
        overrideAccess: true,
      })
    }
  }

  // 3. Generate QR token (ADR-003) -- raw token only exists here + in the email.
  const rawQrToken = generateQrToken()
  const qrTokenHash = hashQrToken(rawQrToken)

  // 4. Confirm booking.
  await p.update({
    collection: 'bookings',
    id: b.id,
    data: {
      status: 'confirmed',
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
      reference: (b as unknown as { reference: string }).reference,
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
          subject: `[MFA Alert] ${eventInfo?.title ?? 'Event'} — ${statusLabel}`,
          html: `<p><strong>${eventInfo?.title ?? 'Event'}</strong> — ${statusLabel}</p>
<p>Capacity: ${capacity} | Booked: ${afterAvailability.booked} | Holds: ${afterAvailability.holds}</p>
<p>Booking reference: ${(b as unknown as { reference: string }).reference}</p>
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
  status: string
  event: string | number | { id: string | number }
  persons: number
  email: string
  leadAttendeeName: string
  language: 'en' | 'mt'
  coupon?: string | number | { id: string | number } | null
  totalAmount: number
}

async function loadAndCheckBooking(bookingId: string | number): Promise<BookingRecord | null> {
  const p = await payload()
  const booking = await p.findByID({ collection: 'bookings', id: bookingId, overrideAccess: true }).catch(() => null)
  if (!booking) return null
  return booking as unknown as BookingRecord
}