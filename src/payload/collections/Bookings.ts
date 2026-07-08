import type { CollectionConfig } from 'payload'

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'reference',
  },
  access: {
    // Public: create their own booking (cart/checkout flow).
    // Admin/door_staff: create is also allowed for manual bookings.
    create: () => true,
    read: ({ req: { user } }) => {
      const u = user as { role?: string } | null
      // Admin: read all
      if (u?.role === 'admin') return true
      // Door-staff: read bookings for check-in (need event/service context)
      if (u?.role === 'door_staff') return true
      // Public: no read access -- bookings are private
      return false
    },
    update: ({ req: { user } }) => {
      const u = user as { role?: string } | null
      // Admin: full update
      if (u?.role === 'admin') return true
      // Door-staff: allowed at base level (field-level restriction in hook)
      if (u?.role === 'door_staff') return true
      return false
    },
    delete: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
  },
  fields: [
    {
      name: 'reference',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'event',
      type: 'relationship',
      relationTo: 'events',
      required: true,
    },
    {
      name: 'leadAttendeeName',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'persons',
      type: 'number',
      required: true,
      min: 1,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Checked In', value: 'checked_in' },
      ],
      defaultValue: 'pending',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'language',
      type: 'select',
      options: [
        { label: 'English', value: 'en' },
        { label: 'Malti', value: 'mt' },
      ],
      defaultValue: 'en',
    },
    {
      name: 'coupon',
      type: 'relationship',
      relationTo: 'coupons',
    },
    {
      name: 'totalAmount',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'checkedInAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'checkInStaff',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
      },
    },
    // --- Phase 2 booking/checkout engine additions ---
    {
      name: 'qrTokenHash',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description:
          'SHA-256 hash of the single-use QR check-in token (ADR-003). The raw token is never stored -- it exists only transiently at issuance and in the confirmation email.',
      },
    },
    {
      name: 'dietaryNotes',
      type: 'textarea',
      admin: {
        description:
          'Optional, data-minimised dietary information (DPIA Sec 6 measure 5). Only collected with explicit consent -- see dietaryConsent.',
      },
    },
    {
      name: 'dietaryConsent',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Explicit consent to store dietary information, per ADR-008 DPIA measure 5.',
      },
    },
    {
      name: 'stripeCheckoutSessionId',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Stripe Checkout Session id (ADR-004).',
      },
    },
    {
      name: 'stripePaymentIntentId',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Stripe PaymentIntent id, set once payment succeeds (ADR-004, C7 amount re-verification trail).',
      },
    },
    {
      name: 'anonymisedAt',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Timestamp when PII fields were anonymised per data-retention policy (DPIA-6, DPIA-10). Null means not yet anonymised. The retention cron skips already-anonymised rows.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      // Field-level restriction: door_staff can only update checkedInAt + status (for check-in).
      // This hook prevents door_staff from modifying financial, personal, or cancellation fields.
      ({ data, req, operation }) => {
        const user = req.user as { role?: string } | null
        if (user?.role === 'door_staff' && operation === 'update') {
          // Only allow updating check-in fields
          const allowedFields = ['checkedInAt', 'checkInStaff', 'status']
          const disallowed = Object.keys(data || {}).filter(
            (k) => !allowedFields.includes(k)
          )
          if (disallowed.length > 0) {
            throw new Error(
              `Door staff cannot modify: ${disallowed.join(', ')}. Only check-in fields (checkedInAt, checkInStaff, status) are permitted.`
            )
          }
        }
        return data
      },
    ],
  },
}
