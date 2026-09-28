/**
 * Consent-gated dietary notes for staff-facing surfaces (search API,
 * check-in responses). Returns null unless the customer ticked
 * dietaryConsent AND left a non-blank note, so staff views never
 * expose dietary data stored without consent (ADR-008 DPIA measure 5).
 */
export function consentedDietaryNotes(booking: {
  dietaryNotes?: string | null
  dietaryConsent?: boolean | null
}): string | null {
  if (!booking.dietaryConsent) return null
  const notes = booking.dietaryNotes?.trim()
  return notes || null
}
