import type { Payload } from 'payload'

import { consentedDietaryNotes } from '@/lib/bookings/dietary'

/**
 * Shared check-in business logic — used by both token-based
 * (POST /api/check-in) and booking-id-based
 * (POST /api/check-in/by-booking-id) endpoints.
 *
 * Extracted per Phase 6 to avoid duplicating the audit-log
 * and booking-update logic across endpoints.
 */

interface CheckInArgs {
  payload: Payload
  booking: {
    id: string | number
    reference: string
    leadAttendeeName: string
    email: string
    persons: number
    status: string
    totalAmount: number
    checkedInAt: string | null
    dietaryNotes?: string | null
    dietaryConsent?: boolean | null
    event: string | number | { id: string | number; title?: string }
  }
  staffUser: { id: string | number; email: string; role: string }
  /**
   * The event selected at the scanning station. When given, a booking for
   * any other event is rejected (`wrong_event`). Omit when the station has
   * no event context.
   */
  eventId?: string | number
}

export async function performCheckIn(args: CheckInArgs): Promise<{
  reference: string
  eventTitle?: string
  leadAttendeeName: string
  persons: number
  status: string
  totalAmount: number
  checkedInAt: string
  dietaryNotes: string | null
}> {
  const { payload: p, booking, staffUser, eventId } = args

  if (booking.status === 'cancelled') {
    throw Object.assign(
      new Error('already_cancelled'),
      { code: 'already_cancelled', reference: booking.reference },
    )
  }

  // `event` is populated (depth >= 1) by both callers, but may be a bare id.
  const bookingEvent = typeof booking.event === 'object' && booking.event !== null ? booking.event : null
  const bookingEventId = bookingEvent ? bookingEvent.id : booking.event
  if (eventId != null && String(eventId) !== '' && String(bookingEventId) !== String(eventId)) {
    throw Object.assign(
      new Error('wrong_event'),
      {
        code: 'wrong_event',
        reference: booking.reference,
        actualEventId: bookingEventId ?? null,
        actualEventTitle: bookingEvent?.title ?? null,
        expectedEventId: eventId,
      },
    )
  }

  if (booking.checkedInAt) {
    throw Object.assign(
      new Error('already_checked_in'),
      { code: 'already_checked_in', checkedInAt: booking.checkedInAt, reference: booking.reference },
    )
  }

  const now = new Date().toISOString()

  await p.update({
    collection: 'bookings',
    id: booking.id,
    data: {
      checkedInAt: now,
      checkInStaff: staffUser.id as string,
      status: 'checked_in',
    },
    overrideAccess: true,
  })

  await p.create({
    collection: 'audit_logs',
    data: {
      action: 'check_in',
      actor: staffUser.id as string,
      collection: 'bookings',
      documentId: String(booking.id),
      detail: booking.reference,
    },
    overrideAccess: true,
  })

  const eventTitle = bookingEvent?.title

  return {
    reference: booking.reference,
    eventTitle,
    leadAttendeeName: booking.leadAttendeeName,
    persons: booking.persons,
    status: 'checked_in',
    totalAmount: booking.totalAmount,
    checkedInAt: now,
    dietaryNotes: consentedDietaryNotes(booking),
  }
}

/**
 * JSON body for a guard error thrown by performCheckIn -- every guard is a
 * 409 on both check-in endpoints. Returns null for any other error, which
 * the caller should re-throw.
 */
export function checkInConflict(err: unknown): Record<string, unknown> | null {
  if (!(err instanceof Error)) return null
  const e = err as Error & Record<string, unknown>
  switch (e.code) {
    case 'already_checked_in':
      return { error: e.code, checkedInAt: e.checkedInAt, reference: e.reference }
    case 'already_cancelled':
      return { error: e.code, reference: e.reference }
    case 'wrong_event':
      return {
        error: e.code,
        reference: e.reference,
        actualEventId: e.actualEventId,
        actualEventTitle: e.actualEventTitle,
        expectedEventId: e.expectedEventId,
      }
    default:
      return null
  }
}
