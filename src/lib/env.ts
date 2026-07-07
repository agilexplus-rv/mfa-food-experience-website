/**
 * Small env-var helpers for the booking engine (Phase 2).
 *
 * Centralised here so every module reads config the same way and we
 * have one place to document what's required for the flow to be fully
 * live (see docs/adr/ADR-004-payment-flow.md, ADR-002).
 */

/** Seat hold TTL in minutes. Defaults to 15 per ADR-002. */
export function holdDurationMinutes(): number {
  const raw = process.env.HOLD_DURATION_MINUTES
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? n : 15
}

/** Whether Stripe is configured (secret key present). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/** Whether the Stripe webhook signature secret is configured. */
export function isStripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET)
}

export function serverUrl(): string {
  return process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
}

/** Shared secret required on the Vercel Cron sweep-holds request. */
export function cronSecret(): string | undefined {
  return process.env.CRON_SECRET
}
