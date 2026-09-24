/**
 * TOTP utilities wrapping otplib v13.
 *
 * Uses otplib's NobleCryptoPlugin (pure-JS, no native deps needed) and
 * ScureBase32Plugin for cross-platform compatibility.
 */

import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'

const cryptoPlugin = new NobleCryptoPlugin()
const base32Plugin = new ScureBase32Plugin()

function createTotp(): TOTP {
  return new TOTP({
    crypto: cryptoPlugin,
    base32: base32Plugin,
  })
}

/** Generate a fresh Base32-encoded TOTP secret. ^ */
export function generateTotpSecret(): string {
  return createTotp().generateSecret()
}

/** Build the otpauth:// URI for QR code display. ^ */
export function buildTotpUri(email: string, secret: string): string {
  return createTotp().toURI({
    label: email,
    issuer: 'Malta Food Experience',
    secret,
  })
}

/** Verify a TOTP code against a secret. Returns true if code is valid. ^ */
export async function verifyTotpCode(
  code: string,
  secret: string,
): Promise<boolean> {
  const result = await createTotp().verify(code, {
    secret,
    epochTolerance: 30, // accept codes within +-30 seconds
  })
  return result.valid
}
