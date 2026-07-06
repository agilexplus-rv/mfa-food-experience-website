import type { CollectionConfig } from 'payload'

export const CouponRedemptions: CollectionConfig = {
  slug: 'coupon_redemptions',
  admin: {
    useAsTitle: 'id',
  },
  access: {
    // Only admins can create coupon redemptions (server-side, not user-initiated)
    create: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    read: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    update: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    delete: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
  },
  fields: [
    { name: 'coupon', type: 'relationship', relationTo: 'coupons', required: true },
    { name: 'booking', type: 'relationship', relationTo: 'bookings', required: true, unique: true },
  ],
}
