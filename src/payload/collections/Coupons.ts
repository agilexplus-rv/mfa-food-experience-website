import crypto from 'node:crypto'
import type { CollectionConfig } from 'payload'

/** Generate a high-entropy coupon code: 10 mixed-case alphanumeric chars, avoiding ambiguous 0/O/1/I/l. */
function generateCouponCode(): string {
  const pool = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(10)
  let code = ''
  for (let i = 0; i < 10; i++) {
    code += pool[bytes[i] % pool.length]
  }
  return code
}

/** Deny-list of trivially-guessable coupon-code patterns. */
const DENIED_CODE_PATTERNS: RegExp[] = [
  /^(.)\1+$/,               // all same character (e.g. "AAAAAA")
  /^0123456789\d*$/,         // sequential digits from 0
  /^123456789\d*$/,          // sequential digits from 1
  /^987654321\d*$/,          // reverse sequential digits
  /^abcdef(g?h?i?j?k?l?m?n?o?p?q?r?s?t?u?v?w?x?y?z?)$/,  // sequential lowercase letters
]

function isDeniedCode(code: string): boolean {
  return DENIED_CODE_PATTERNS.some((p) => p.test(code))
}

/**
 * beforeValidate hook: auto-generate a high-entropy coupon code when the
 * admin leaves the field blank; enforce minimum complexity when the admin
 * supplies a manual code.
 *
 * DESIGN CHOICE: auto-generate on blank (the most secure default). When
 * the admin types their own code we enforce length >= 6 and reject
 * trivially-guessable patterns (all-same-char, sequential digits/letters).
 * The admin always sees the generated code in the form after creation so
 * they can communicate it to their marketing channels.
 */
function enforceCouponCodeEntropy({ data, operation }: {
  data?: Record<string, unknown>
  operation: 'create' | 'update'
}): Record<string, unknown> | undefined {
  // Only enforce on create; updates to other fields should not re-validate or re-generate
  if (operation !== 'create') return data
  if (!data) return data

  const code = typeof data.code === 'string' ? data.code.trim() : ''

  if (!code) {
    // Auto-generate
    data.code = generateCouponCode()
  } else if (code.length < 6) {
    throw new Error('Coupon code must be at least 6 characters. Leave the field blank to auto-generate a secure code.')
  } else if (isDeniedCode(code)) {
    throw new Error('Coupon code is too predictable (e.g. all same character, sequential). Use a less guessable code or leave blank to auto-generate.')
  }

  return data
}

export const Coupons: CollectionConfig = {
  slug: 'coupons',
  admin: {
    useAsTitle: 'code',
  },
  access: {
    create: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    // Admin: full read; Door-staff: read-only (may need to see coupons for check-in context)
    // Public: no read — coupon details are server-side only
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    delete: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
  },
  fields: [
    { name: 'code', type: 'text', required: true, unique: true },
    { name: 'type', type: 'select',
      options: [
        { label: 'Percentage', value: 'percentage' },
        { label: 'Fixed Amount', value: 'fixed' },
      ],
      required: true, admin: { position: 'sidebar' },
    },
    { name: 'value', type: 'number', required: true, min: 0 },
    { name: 'validFrom', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly' } } },
    { name: 'validUntil', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly' } } },
    { name: 'maxTotalUses', type: 'number', min: 1 },
    { name: 'maxUsesPerBooking', type: 'number', min: 1, defaultValue: 1 },
    { name: 'applicableServices', type: 'relationship', relationTo: 'services', hasMany: true },
    { name: 'active', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar' } },
    { name: 'useCount', type: 'number', defaultValue: 0, min: 0, admin: { position: 'sidebar', readOnly: true } },
  ],
  hooks: {
    beforeValidate: [enforceCouponCodeEntropy],
  },
}
