/**
 * QR token generation per ADR-003.
 *
 * - 128-bit (16-byte) cryptographically random token.
 * - Base32-encoded (RFC 4648, lowercase, no padding) for QR density.
 * - Only the SHA-256 hash of the token is ever persisted; the raw
 *   token exists transiently in memory and in the confirmation email.
 *
 * @compliance C9, DPIA Sec 6.3 -- see docs/adr/ADR-003-qr-token.md
 */
import crypto from 'crypto'

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'

/**
 * RFC 4648 base32 encode (lowercase, unpadded). Node's Buffer#toString
 * has no 'base32' encoding, so we implement the bit-packing manually.
 */
function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return output
}

/** Generate a new raw QR token. ~26 lowercase base32 characters. */
export function generateQrToken(): string {
  return base32Encode(crypto.randomBytes(16))
}

/** SHA-256 hash of a raw token, hex-encoded -- the only form ever stored. */
export function hashQrToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}
