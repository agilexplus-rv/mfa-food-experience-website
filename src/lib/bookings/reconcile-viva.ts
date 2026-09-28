import { finalizeBookingFromVivaTransaction } from '@/lib/bookings/finalize'
import { getTransaction, VivaUnreachableError } from '@/lib/viva/client'

/** Upper bound on the VIVA lookup; the confirmation page render waits on it. */
const LOOKUP_TIMEOUT_MS = 8000

/**
 * Pull-based fallback for the VIVA "Transaction Payment Created" webhook.
 *
 * The webhook is the primary way a booking flips pending -> confirmed,
 * but VIVA's demo environment does not reliably deliver webhooks (and in
 * production a delivery can be delayed or dropped). Without a fallback
 * the confirmation page polls a booking that will never change and the
 * visitor waits forever.
 *
 * Given the ?t={TransactionId}&s={OrderCode} VIVA appended to the success
 * redirect, we ask the VIVA API for the transaction and finalise through
 * the exact same path as the webhook. The redirect params are HINTS only,
 * with the same guarantees as the unauthenticated demo webhook body:
 * - the transaction must exist on OUR merchant account (API lookup),
 * - it must be completed (statusId 'F'),
 * - its API-reported OrderCode must equal ?s=,
 * - finalize.ts then enforces amount == booking total and that one
 *   TransactionId confirms one booking.
 * So confirming a booking this way still requires a real, fully-paid
 * transaction for that exact order. Idempotent with the webhook: the
 * atomic pending -> confirmed claim picks exactly one winner.
 *
 * 'unreachable' means VIVA itself is down (network error, timeout, 5xx),
 * so the pages can say "try again shortly" instead of spinning forever.
 */

export type VivaReconcileOutcome =
  | 'confirmed' // this call (or an earlier webhook) confirmed the booking
  | 'not_completed' // VIVA reports the transaction as not (yet) completed
  | 'mismatch' // transaction does not belong to this order
  | 'rejected' // finalize refused (amount mismatch, paid after cancel, ...)
  | 'unreachable' // VIVA API down / timed out / 5xx: worth retrying later
  | 'unavailable' // not configured / tx not found yet / finalisation threw

export async function reconcileVivaPayment(input: {
  orderCode: string
  transactionId: string
}): Promise<VivaReconcileOutcome> {
  let tx: Awaited<ReturnType<typeof getTransaction>>
  try {
    tx = await getTransaction(input.transactionId, { timeoutMs: LOOKUP_TIMEOUT_MS })
  } catch (err) {
    if (err instanceof VivaUnreachableError) {
      console.warn('[bookings/reconcile-viva] VIVA API unreachable:', err.message)
      return 'unreachable'
    }
    console.warn('[bookings/reconcile-viva] Transaction lookup failed:', err)
    return 'unavailable'
  }

  if (tx.statusId !== 'F') return 'not_completed'

  if (tx.orderCode == null || String(tx.orderCode) !== input.orderCode) {
    console.warn('[bookings/reconcile-viva] OrderCode does not match verified transaction', {
      requestedOrderCode: input.orderCode,
      verifiedOrderCode: tx.orderCode,
      transactionId: input.transactionId,
    })
    return 'mismatch'
  }

  try {
    const result = await finalizeBookingFromVivaTransaction({
      orderCode: String(tx.orderCode),
      transactionId: input.transactionId,
      amount: tx.amount,
      merchantTrns: tx.merchantTrns,
    })
    if (result.ok) return 'confirmed'
    console.error('[bookings/reconcile-viva] Booking finalisation failed:', result.reason)
    return 'rejected'
  } catch (err) {
    console.error('[bookings/reconcile-viva] Booking finalisation threw:', err)
    return 'unavailable'
  }
}
