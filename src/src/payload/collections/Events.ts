import type { CollectionConfig } from 'payload'

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    create: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    // Admin/door_staff: read all (door_staff needs event context for check-in)
    // Public: read only scheduled events
    read: ({ req: { user } }) => {
      if (user) return true
      return { status: { equals: 'scheduled' } }
    },
    update: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    delete: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
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
      // Recurring events (Rudie 2026-07-12): occurrences generated from
      // one "repeat" form submission share a seriesId (UUID). Each
      // occurrence is an independent row -- independently editable,
      // cancellable, bookable -- the series link exists only for
      // "edit this and future events" scoped updates. No RRULE
      // materialisation at read time; the console generates concrete
      // rows up front (bounded, max 52 occurrences per series).
      name: 'seriesId',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Present when this event was created as part of a recurring series.',
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
