import type { CollectionConfig } from 'payload'

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'service',
      type: 'relationship',
      relationTo: 'services',
      required: true,
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'dayOnly' },
      },
    },
    {
      name: 'startTime',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'timeOnly' },
      },
    },
    {
      name: 'endTime',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'timeOnly' },
      },
    },
    {
      name: 'capacity',
      type: 'number',
      required: true,
      min: 1,
    },
    {
      name: 'pricePerPerson',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'locationRef',
      type: 'text',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Completed', value: 'completed' },
      ],
      defaultValue: 'scheduled',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'fullyBookedOverride',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'FR-2.5: Manually mark as fully booked (overrides capacity calculation).',
      },
    },
  ],
}
