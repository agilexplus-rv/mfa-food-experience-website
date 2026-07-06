// Password strength validation per ADR-008 C4 (strong password policy).
// minLength 12, requires upper/lower/number/symbol.

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = []
  if (!password || password.length < 12) {
    errors.push('Password must be at least 12 characters.')
  }
  if (!/[A-Z]/.test(password)) errors.push('Must contain an uppercase letter.')
  if (!/[a-z]/.test(password)) errors.push('Must contain a lowercase letter.')
  if (!/[0-9]/.test(password)) errors.push('Must contain a number.')
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Must contain a symbol.')
  return { valid: errors.length === 0, errors }
}
