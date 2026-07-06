import type { CollectionConfig } from 'payload'

export const SeatHolds: CollectionConfig = {
  slug: 'seat_holds',
  admin: {
    useAsTitle: 'id',
  },
  fields: [
    {
      name: 'event',
      type: 'relationship',
      relationTo: 'events',
      required: true,
      index: true,
    },
    {
      name: 'sessionId',
      type: 'text',
      required: true,
    },
    {
      name: 'seats',
      type: 'number',
      required: true,
      min: 1,
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      index: true,
    },
  ],
}
