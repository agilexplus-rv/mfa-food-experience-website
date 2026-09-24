import { z } from 'zod'

/**
 * Server-side input validation for the booking/checkout API surface.
 * @compliance C1 -- see docs/adr/ADR-008-compliance-gate.md
 */

export const createHoldSchema = z.object({
  eventId: z.union([z.string(), z.number()]),
  seats: z.number().int().min(1).max(20),
  sessionId: z.string().min(8).max(200),
})
export type CreateHoldInput = z.infer<typeof createHoldSchema>

export const checkoutSchema = z.object({
  eventId: z.union([z.string(), z.number()]),
  holdId: z.union([z.string(), z.number()]),
  sessionId: z.string().min(8).max(200),
  seats: z.number().int().min(1).max(20),
  leadAttendeeName: z.string().trim().min(1).max(200),
  email: z.string().trim().email(),
  phone: z.string().trim().max(50).optional(),
  language: z.enum(['en', 'mt']).default('en'),
  dietaryNotes: z.string().trim().max(1000).optional(),
  dietaryConsent: z.boolean().optional(),
  couponCode: z.string().trim().max(64).optional(),
  cancellationPolicyAccepted: z.literal(true),
  /** Cloudflare Turnstile token from the client-side widget. Optional — not enforced when Turnstile is not configured. */
  turnstileToken: z.string().max(2048).optional(),
})
export type CheckoutInput = z.infer<typeof checkoutSchema>

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1).max(64),
  eventId: z.union([z.string(), z.number()]),
  seats: z.number().int().min(1).max(20),
})
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>
