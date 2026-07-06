import type { CollectionConfig } from 'payload'

export const CouponRedemptions: CollectionConfig = {
  slug: 'coupon_redemptions',
  admin: {
    useAsTitle: 'id',
  },
  fields: [
    {
      name: 'coupon',
      type: 'relationship',
      relationTo: 'coupons',
      required: true,
    },
    {
      name: 'booking',
      type: 'relationship',
      relationTo: 'bookings',
      required: true,
      unique: true,
    },
  ],
}
