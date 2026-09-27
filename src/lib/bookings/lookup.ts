import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Server-side booking lookup for the VIVA Smart Checkout return pages
 * (/booking/confirmation and /booking/cancel).
 *
 * The lookup key is the payment reference the provider appended to the
 * redirect URL: VIVA's OrderCode (?s=) or, for legacy bookings, the
 * Stripe Checkout Session id (?session_id=). Both are long, unguessable
 * values only the paying visitor receives, so, like Stripe's
 * session_id, they act as a capability for viewing that one booking.
 * Sequential booking ids are never accepted here (see the data
 * minimisation note on /api/bookings/[id]/status).
 *
 * Server-only: pulls in the Payload local API.
 */

export interface BookingEventSummary {
  id: string | number
  title: string
  date: string
  startTime: string
  endTime: string
  locationRef: string
  status: 'scheduled' | 'cancelled' | 'completed'
}

export interface BookingSummary {
  id: string | number
  reference: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'checked_in'
  persons: number
  totalAmount: number
  leadAttendeeName: string
  email: string
  paymentDeadline?: string | null
  event: BookingEventSummary | null
}

export type BookingLookupResult =
  | { kind: 'found'; booking: BookingSummary }
  | { kind: 'not_found' }
  | { kind: 'error' }

/** VIVA OrderCodes are 16-digit numbers; allow some slack but reject junk. */
const VIVA_ORDER_CODE_RE = /^\d{10,20}$/
/** VIVA TransactionIds are UUIDs. */
const VIVA_TRANSACTION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Stripe Checkout Session ids, e.g. cs_test_a1B2c3... */
const STRIPE_SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]{10,}$/

export function parseVivaOrderCode(value: string | undefined): string | undefined {
  const v = value?.trim()
  return v && VIVA_ORDER_CODE_RE.test(v) ? v : undefined
}

export function parseVivaTransactionId(value: string | undefined): string | undefined {
  const v = value?.trim()
  return v && VIVA_TRANSACTION_ID_RE.test(v) ? v : undefined
}

export function parseStripeSessionId(value: string | undefined): string | undefined {
  const v = value?.trim()
  return v && STRIPE_SESSION_ID_RE.test(v) ? v : undefined
}

export async function findBookingByPaymentRef(
  ref: { vivaOrderCode: string } | { stripeSessionId: string },
): Promise<BookingLookupResult> {
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'bookings',
      where:
        'vivaOrderCode' in ref
          ? { vivaOrderCode: { equals: ref.vivaOrderCode } }
          : { stripeCheckoutSessionId: { equals: ref.stripeSessionId } },
      depth: 1,
      limit: 1,
      overrideAccess: true,
    })

    const doc = result.docs[0] as
      | (Omit<BookingSummary, 'event'> & { event: string | number | BookingEventSummary | null })
      | undefined
    if (!doc) return { kind: 'not_found' }

    const event = doc.event && typeof doc.event === 'object' ? doc.event : null
    return {
      kind: 'found',
      booking: {
        id: doc.id,
        reference: doc.reference,
        status: doc.status,
        persons: doc.persons,
        totalAmount: doc.totalAmount,
        leadAttendeeName: doc.leadAttendeeName,
        email: doc.email,
        paymentDeadline: doc.paymentDeadline,
        event: event
          ? {
              id: event.id,
              title: event.title,
              date: event.date,
              startTime: event.startTime,
              endTime: event.endTime,
              locationRef: event.locationRef,
              status: event.status,
            }
          : null,
      },
    }
  } catch (err) {
    console.error('[bookings/lookup] Booking lookup failed:', err)
    return { kind: 'error' }
  }
}
