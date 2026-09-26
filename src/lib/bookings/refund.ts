import { getPayload } from 'payload'
import config from '@payload-config'

import { refundTransaction, VivaNotConfiguredError } from '@/lib/viva/client'
import { isVivaConfigured } from '@/lib/env'
import {
  coolingOffHours,
  formatCoolingOffPeriod,
  resolveTierForDaysBefore,
  type CancellationPolicyData,
  type CancellationTier,
} from '@/lib/policies/cancellation'

export interface RefundInput {
  bookingId: string | number
  reference: string
  status: string
  totalAmount: number
  vivaTransactionId?: string | null
  vivaRefundId?: string | null
  eventDate: string | null
  /** When the booking was made (ISO) -- used for the voluntary cooling-off window. */
  bookedAt?: string | null
  /** When true, ignore the cancellation-policy tier and issue a full refund. */
  overrideTier?: boolean
}

export interface RefundResult {
  refundId?: string
  refundStatus: string
  refundAmountEuros: number
  tier: CancellationTier | null
  tierLabel: string
  overridden: boolean
  /** True when the full refund was granted by the cooling-off period. */
  coolingOff: boolean
}

/**
 * Compute and issue a VIVA refund for a booking cancellation.
 *
 * Applies the cancellation-policy tier logic to determine the refund
 * percentage unless `overrideTier` is true (staff full-refund override).
 *
 * @returns RefundResult with details for the audit log and booking update.
 */
export async function processCancellationRefund(
  input: RefundInput,
): Promise<RefundResult> {
  // --- Determine refund percentage from cancellation policy ---
  let tier: CancellationTier | null = null
  let tierLabel = 'No policy'
  let overridden = false
  // The policy is active but the cancellation is past every tier's
  // deadline: no refund (previously this fell through to a full refund).
  let noTierMatched = false
  let coolingOff = false

  if (input.overrideTier) {
    overridden = true
    tierLabel = 'Full refund (staff override)'
    tier = null
  } else {
    try {
      const payload = await getPayload({ config })
      const policy = (await payload.findGlobal({
        slug: 'cancellation-policy',
      })) as unknown as CancellationPolicyData

      // Voluntary cooling-off period (admin toggle): a cancellation within
      // N hours of booking gets a full refund regardless of the tiers.
      const coolHours = coolingOffHours(policy)
      const bookedMs = input.bookedAt ? new Date(input.bookedAt).getTime() : NaN
      if (coolHours > 0 && Number.isFinite(bookedMs) && Date.now() - bookedMs <= coolHours * 3_600_000) {
        coolingOff = true
        tierLabel = `Full refund (within ${formatCoolingOffPeriod(coolHours)} cooling-off period)`
      } else if (!input.eventDate) {
        tierLabel = 'Full refund (no event date)'
      } else if (policy.enabled && policy.tiers && policy.tiers.length > 0) {
        const eventTime = new Date(input.eventDate).getTime()
        const now = Date.now()
        const daysBefore = Math.floor(
          (eventTime - now) / (1000 * 60 * 60 * 24),
        )

        tier = resolveTierForDaysBefore(daysBefore, policy.tiers)
        if (tier) {
          tierLabel =
            tier.label && tier.label.trim() !== ''
              ? tier.label.trim()
              : tier.refundPercentage === 100
                ? 'Full refund'
                : tier.refundPercentage === 0
                  ? 'No refund'
                  : `${tier.refundPercentage}% refund`
        } else {
          tierLabel = 'No refund (cancellation too late for any tier)'
          noTierMatched = true
        }
      } else {
        tierLabel = 'Full refund (policy disabled)'
      }
    } catch {
      tierLabel = 'Full refund (policy unavailable)'
    }
  }

  const refundPct = overridden || coolingOff ? 100 : tier ? tier.refundPercentage : noTierMatched ? 0 : 100
  // Round to whole cents (not whole euros): 50% of €45.50 is €22.75.
  const refundAmountEuros = Math.round(input.totalAmount * refundPct) / 100

  // --- VIVA refund ---
  let refundId: string | undefined
  let refundStatus = 'none'

  if (input.vivaRefundId) {
    refundId = input.vivaRefundId
    refundStatus = 'succeeded'
    return {
      refundId,
      refundStatus,
      refundAmountEuros: 0,
      tier: overridden ? null : tier,
      tierLabel,
      overridden,
      coolingOff,
    }
  }

  if (refundAmountEuros === 0) {
    refundStatus = 'none'
    return {
      refundId: undefined,
      refundStatus,
      refundAmountEuros: 0,
      tier,
      tierLabel,
      overridden,
      coolingOff,
    }
  }

  if (input.vivaTransactionId && isVivaConfigured()) {
    try {
      const result = await refundTransaction({
        transactionId: input.vivaTransactionId,
        amount: Math.round(refundAmountEuros * 100), // VIVA expects integer cents
        merchantTrns: input.reference,
      })
      refundId = result.transactionId
      refundStatus = 'succeeded'
    } catch (err) {
      if (err instanceof VivaNotConfiguredError) {
        console.warn(
          '[console/cancel] VIVA not configured, skipping refund for booking',
          input.reference,
        )
        refundStatus = 'none'
      } else {
        console.error(
          '[console/cancel] VIVA refund failed for booking',
          input.reference,
          err,
        )
        throw err
      }
    }
  } else if (isVivaConfigured() && !input.vivaTransactionId) {
    console.info(
      '[console/cancel] No vivaTransactionId on booking',
      input.reference,
      '— skipping refund, cancelling directly',
    )
    refundStatus = 'none'
  }

  return {
    refundId,
    refundStatus,
    refundAmountEuros,
    tier,
    tierLabel,
    overridden,
    coolingOff,
  }
}