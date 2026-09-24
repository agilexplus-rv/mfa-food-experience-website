import { getPayload } from 'payload'
import config from '@payload-config'

import { getStripe, StripeNotConfiguredError } from '@/lib/stripe/client'
import { isStripeConfigured } from '@/lib/env'
import {
  resolveTierForDaysBefore,
  type CancellationPolicyData,
  type CancellationTier,
} from '@/lib/policies/cancellation'

export interface RefundInput {
  bookingId: string | number
  reference: string
  status: string
  totalAmount: number
  stripePaymentIntentId?: string | null
  stripeRefundId?: string | null
  eventDate: string | null
  /** When true, ignore the cancellation-policy tier and issue a full refund. */
  overrideTier?: boolean
}

export interface RefundResult {
  refundId?: string
  refundStatus: string
  refundAmountCents: number
  tier: CancellationTier | null
  tierLabel: string
  overridden: boolean
}

/**
 * Compute and issue a Stripe refund for a booking cancellation.
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

  if (input.overrideTier) {
    overridden = true
    tierLabel = 'Full refund (staff override)'
    tier = null // signal full refund
  } else if (input.eventDate) {
    try {
      const payload = await getPayload({ config })
      const policy = (await payload.findGlobal({
        slug: 'cancellation-policy',
      })) as unknown as CancellationPolicyData

      if (policy.enabled && policy.tiers && policy.tiers.length > 0) {
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
          tierLabel = 'No tier matched (cancellation too late)'
        }
      } else {
        // Policy exists but is disabled or has no tiers — full refund default
        tierLabel = 'Full refund (policy disabled)'
      }
    } catch {
      // If the policy global doesn't exist yet, default to full refund
      tierLabel = 'Full refund (policy unavailable)'
    }
  }

  const refundPct =
    overridden || !tier ? 100 : tier.refundPercentage
  const refundAmountCents = Math.round(
    (input.totalAmount * refundPct) / 100,
  )

  // --- Stripe refund ---
  let refundId: string | undefined
  let refundStatus = 'none'

  if (input.stripeRefundId) {
    // Already refunded — idempotency guard
    refundId = input.stripeRefundId
    refundStatus = 'succeeded'
    return {
      refundId,
      refundStatus,
      refundAmountCents: 0,
      tier: overridden ? null : tier,
      tierLabel,
      overridden,
    }
  }

  if (refundAmountCents === 0) {
    // Zero refund — skip Stripe, record appropriately
    refundStatus = 'none'
    return {
      refundId: undefined,
      refundStatus,
      refundAmountCents: 0,
      tier,
      tierLabel,
      overridden,
    }
  }

  if (input.stripePaymentIntentId && isStripeConfigured()) {
    try {
      const stripe = getStripe()

      // Check for existing refund on this payment intent
      const existingRefunds = await stripe.refunds.list({
        payment_intent: input.stripePaymentIntentId,
        limit: 5,
      })
      const alreadyRefunded = existingRefunds.data.find(
        (r) => r.status === 'succeeded' || r.status === 'pending',
      )
      if (alreadyRefunded) {
        refundId = alreadyRefunded.id
        refundStatus = alreadyRefunded.status ?? 'succeeded'
        return {
          refundId,
          refundStatus,
          refundAmountCents,
          tier,
          tierLabel,
          overridden,
        }
      }

      // Issue the refund with the computed amount
      const refund = await stripe.refunds.create({
        payment_intent: input.stripePaymentIntentId,
        amount: refundAmountCents,
      })
      refundId = refund.id
      refundStatus = refund.status ?? 'pending'
    } catch (err) {
      if (err instanceof StripeNotConfiguredError) {
        console.warn(
          '[console/cancel] Stripe not configured, skipping refund for booking',
          input.reference,
        )
        refundStatus = 'none'
      } else {
        console.error(
          '[console/cancel] Stripe refund failed for booking',
          input.reference,
          err,
        )
        throw err // re-throw so the route can return a 500
      }
    }
  } else if (isStripeConfigured() && !input.stripePaymentIntentId) {
    console.info(
      '[console/cancel] No PaymentIntent on booking',
      input.reference,
      '— skipping refund, cancelling directly',
    )
    refundStatus = 'none'
  }

  return {
    refundId,
    refundStatus,
    refundAmountCents,
    tier,
    tierLabel,
    overridden,
  }
}
