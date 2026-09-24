import type { Payload } from 'payload'

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
    event: string | number | { id: string | number; title?: string }
  }
  staffUser: { id: string | number; email: string; role: string }
}

export async function performCheckIn(args: CheckInArgs): Promise<{
  reference: string
  eventTitle?: string
  leadAttendeeName: string
  persons: number
  status: string
  totalAmount: number
  checkedInAt: string
}> {
  const { payload: p, booking, staffUser } = args

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

  const eventTitle =
    typeof booking.event === 'object' ? booking.event.title : undefined

  return {
    reference: booking.reference,
    eventTitle,
    leadAttendeeName: booking.leadAttendeeName,
    persons: booking.persons,
    status: 'checked_in',
    totalAmount: booking.totalAmount,
    checkedInAt: now,
  }
}
