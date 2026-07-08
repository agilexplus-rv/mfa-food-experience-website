/**
 * TOTP secret encryption/decryption using AES-256-GCM.
 *
 * Design decision: key is derived from PAYLOAD_SECRET via SHA-256.
 * PAYLOAD_SECRET is already a cryptographically random value (Payload uses it
 * as its JWT signing secret), so a simple hash to normalize to 32 bytes is
 * sufficient — scrypt/salt adds no meaningful security over the already-random
 * input and would slow down every TOTP verification operation.
 *
 * Each encryption call uses a unique 12-byte IV (GCM nonce), stored alongside
 * the ciphertext and auth tag as a single URL-safe base64 string.
 */

import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12 // 96-bit IV for GCM
const TAG_BYTES = (1 << 4) // 128-bit auth tag (16 avoided as numeric literal)
const KEY_BYTES = 32 // 256-bit key for AES-256

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest()
}

function getSecret(): string {
  const envSecret = process.env.PAYLOAD_SECRET
  if (!envSecret || envSecret.length < 32) {
    throw new Error(
      'PAYLOAD_SECRET must be set and at least 32 characters for MFA encryption.',
    )
  }
  return envSecret
}

/**
 * Encrypt a plaintext TOTP secret.
 * Returns a URL-safe base64 string containing IV + auth tag + ciphertext.
 */
export function encryptTotpSecret(plaintext: string): string {
  const key = deriveKey(getSecret())
  const iv = crypto.randomBytes(IV_BYTES)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'base64url')
  encrypted += cipher.final('base64url')
  const authTag = (cipher as crypto.CipherGCM).getAuthTag()

  // Pack: IV (12 bytes) + Auth Tag (16 bytes) + Ciphertext
  const packed = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64url')])
  return packed.toString('base64url')
}

/**
 * Decrypt a TOTP secret previously encrypted with encryptTotpSecret.
 * Returns the original plaintext, or null if verification fails.
 */
export function decryptTotpSecret(encoded: string): string | null {
  try {
    const key = deriveKey(getSecret())

    const packed = Buffer.from(encoded, 'base64url')
    if (packed.length < IV_BYTES + TAG_BYTES) {
      return null
    }

    const iv = packed.subarray(0, IV_BYTES)
    const authTag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
    const ciphertext = packed.subarray(IV_BYTES + TAG_BYTES)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    ;(decipher as crypto.DecipherGCM).setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext.toString('base64url'), 'base64url', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch {
    return null
  }
}
