/**
 * Pure type definitions + price formatting for event availability.
 *
 * Safe to import from Client Components — pulls in NO Payload/server-only code.
 * The server-side query helpers live in `./availability.ts` (server-only).
 *
 * FR-2.3 / FR-2.4 — remaining seats = capacity − booked − active holds.
 */

export type AvailabilityStatus = 'available' | 'limited' | 'fully_booked'

export interface EventAvailability {
  /** Seats still bookable: capacity − booked − active holds (≥0). */
  remaining: number
  /** Total event capacity. */
  capacity: number
  /** Counted booked seats (pending + confirmed + checked_in). */
  booked: number
  /** Active (unexpired) held seats. */
  holds: number
  /** Manual override — when true the event is fully booked regardless of math. */
  override: boolean
  /** Derived status for UI badges. */
  status: AvailabilityStatus
}

/** Loose event shape from the Local API (no generated types committed yet). */
export interface EventDoc {
  id: string | number
  title: string
  date: string
  startTime: string
  endTime: string
  capacity: number
  pricePerPerson: number
  locationRef: string
  status: 'scheduled' | 'cancelled' | 'completed'
  fullyBookedOverride?: boolean
  service?: string | number | { id: string | number }
}

export function formatPrice(perPerson: number): string {
  return new Intl.NumberFormat('en-MT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(perPerson)
}
