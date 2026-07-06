import type { CollectionConfig } from 'payload'

export const SeatHolds: CollectionConfig = {
  slug: 'seat_holds',
  admin: {
    useAsTitle: 'id',
  },
  access: {
    // Public: create for cart hold during booking flow
    create: () => true,
    // Admin: read all seat holds (for monitoring/debugging)
    // Door-staff: none (per ADR-008 C6 — no need to see cart state)
    read: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    update: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    delete: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
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
