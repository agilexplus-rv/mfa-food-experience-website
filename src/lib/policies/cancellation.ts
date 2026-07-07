import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Shape of a single cancellation tier as stored in the CancellationPolicy Global.
 */
export interface CancellationTier {
  minDaysBeforeEvent: number
  refundPercentage: number
  label?: string | null
}

/**
 * Shape of the CancellationPolicy Global document as returned by Payload.
 */
export interface CancellationPolicyData {
  id?: string | number
  enabled: boolean
  introText?: string | null
  tiers?: CancellationTier[] | null
  organiserCancellationText?: string | null
  withdrawalRightDisclosure?: string | null
  updatedAt?: string
  createdAt?: string
}

/**
 * Fetch the CancellationPolicy Global from Payload.
 *
 * Uses the local API; suitable for server components, API routes,
 * and generateMetadata.
 */
export async function getCancellationPolicy(): Promise<CancellationPolicyData> {
  const payload = await getPayload({ config })
  return (await payload.findGlobal({
    slug: 'cancellation-policy',
  })) as unknown as CancellationPolicyData
}

/**
 * Pure function: resolve which cancellation tier applies given the
 * number of days before the event a cancellation is requested.
 *
 * Matching logic: find the tier with the LARGEST `minDaysBeforeEvent`
 * that is <= `daysBefore`. This gives the most generous (i.e. highest
 * refund) tier the booking still qualifies for, assuming the admin has
 * listed tiers in descending minDaysBeforeEvent order.
 *
 * Returns the matching tier, or null if no tier's minDaysBeforeEvent
 * is <= daysBefore (e.g. the booking is after the event).
 *
 * ## Example 1 — three-tier policy
 *
 *   tiers = [
 *     { minDaysBeforeEvent: 7,  refundPercentage: 100, label: '' },
 *     { minDaysBeforeEvent: 3,  refundPercentage: 50,  label: '' },
 *     { minDaysBeforeEvent: 0,  refundPercentage: 0,   label: 'No refund' },
 *   ]
 *
 *   resolveTierForDaysBefore(10, tiers) → tier 7  (100%)   // 7 is largest <= 10
 *   resolveTierForDaysBefore(5,  tiers) → tier 3  (50%)    // 3 is largest <= 5
 *   resolveTierForDaysBefore(1,  tiers) → tier 0  (0%)     // 0 is largest <= 1
 *   resolveTierForDaysBefore(0,  tiers) → tier 0  (0%)     // 0 is largest <= 0
 *
 * ## Example 2 — two-tier policy (admin disabled cancellations within 48h)
 *
 *   tiers = [
 *     { minDaysBeforeEvent: 7,  refundPercentage: 100, label: '' },
 *     { minDaysBeforeEvent: 2,  refundPercentage: 0,   label: 'No refund' },
 *   ]
 *
 *   resolveTierForDaysBefore(8,  tiers) → tier 7  (100%)   // 7 is largest <= 8
 *   resolveTierForDaysBefore(2,  tiers) → tier 2  (0%)     // 2 is largest <= 2
 *   resolveTierForDaysBefore(1,  tiers) → null             // nothing is <= 1
 *
 * ## Edge cases
 *
 *   - Empty tiers array → null.
 *   - Negative daysBefore → null (can't cancel after the event).
 *   - Tiers with identical minDaysBeforeEvent → the one that appears
 *     first wins (behaviour is determined by the sort order of the
 *     admin's input; no de-duplication is performed).
 */
export function resolveTierForDaysBefore(
  daysBefore: number,
  tiers: CancellationTier[],
): CancellationTier | null {
  if (!tiers || tiers.length === 0) return null

  let best: CancellationTier | null = null
  let bestDays = -1

  for (const tier of tiers) {
    if (
      tier.minDaysBeforeEvent <= daysBefore &&
      tier.minDaysBeforeEvent > bestDays
    ) {
      best = tier
      bestDays = tier.minDaysBeforeEvent
    }
  }

  return best
}

/**
 * Generate a human-readable label for a cancellation tier.
 * Uses the admin's custom label if provided; otherwise auto-generates
 * from the refund percentage.
 *
 * Examples:
 *   { refundPercentage: 100, label: '' }  → "Full refund"
 *   { refundPercentage: 50,  label: '' }  → "50% refund"
 *   { refundPercentage: 0,   label: '' }  → "No refund"
 *   { refundPercentage: 100, label: 'Full refund minus 10% admin fee' } → "Full refund minus 10% admin fee"
 *   { refundPercentage: 75,  label: null } → "75% refund"
 */
export function formatTierLabel(tier: CancellationTier): string {
  if (tier.label && tier.label.trim() !== '') {
    return tier.label.trim()
  }
  if (tier.refundPercentage === 100) return 'Full refund'
  if (tier.refundPercentage === 0) return 'No refund'
  return `${tier.refundPercentage}% refund`
}

/**
 * Generate a human-readable "Cancel at least N days before" label.
 *
 * Examples:
 *   minDaysBeforeEvent = 7  → "7 days before"
 *   minDaysBeforeEvent = 1  → "1 day before"
 *   minDaysBeforeEvent = 0  → "Day of event"
 */
export function formatDaysBeforeLabel(days: number): string {
  if (days === 0) return 'Day of event'
  if (days === 1) return '1 day before'
  return `${days} days before`
}
