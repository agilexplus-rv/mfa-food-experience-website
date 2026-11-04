/**
 * Official email address of the Malta Food Experience initiatives.
 *
 * Single source of truth for every place the public-facing contact address
 * is published: site footer, contact page, drafted policies and seed content.
 * Previously these were hardcoded as bookings@foodagency.mt / info@foodagency.mt.
 *
 * Not the technical sender (FROM_EMAIL / noreply@...), which stays
 * environment-configured.
 */
export const OFFICIAL_EMAIL = 'foodexperience.mfa@gov.mt'

export const OFFICIAL_EMAIL_MAILTO = `mailto:${OFFICIAL_EMAIL}`
