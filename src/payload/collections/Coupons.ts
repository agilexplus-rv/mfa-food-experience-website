import type { CollectionConfig } from 'payload'

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
}
