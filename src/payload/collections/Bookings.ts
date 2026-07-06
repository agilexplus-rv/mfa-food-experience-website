import type { CollectionConfig } from 'payload'

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'reference',
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
  ],
}
