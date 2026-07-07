import Stripe from 'stripe'

/**
 * Lazily-constructed Stripe client. We deliberately do NOT construct
 * this at module load time (some build/typecheck passes import this
 * module without STRIPE_SECRET_KEY present) -- the ADK for this task
 * calls for code that typechecks/builds without live keys and only
 * fails at request time with a clear error.
 *
 * @compliance NFR-4, DPIA Sec 6.2 -- see docs/adr/ADR-004-payment-flow.md
 */
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new StripeNotConfiguredError()
  }
  _stripe = new Stripe(key, {
    apiVersion: '2026-06-24.dahlia',
  })
  return _stripe
}

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Stripe is not configured (STRIPE_SECRET_KEY is unset). Online payment is not yet available.')
    this.name = 'StripeNotConfiguredError'
  }
}
