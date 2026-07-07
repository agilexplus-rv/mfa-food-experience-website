import crypto from 'crypto'

/**
 * Human-friendly, collision-resistant booking reference, e.g. "MFA-7K3QZ9".
 * Not used for security (that's the QR token, ADR-003) -- just a short,
 * readable identifier for emails, on-screen confirmation, and support.
 */
export function generateBookingReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I ambiguity
  let out = ''
  const bytes = crypto.randomBytes(6)
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return `MFA-${out}`
}
