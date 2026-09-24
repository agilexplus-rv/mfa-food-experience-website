import type { CollectionConfig } from 'payload'

export const Testimonials: CollectionConfig = {
  slug: 'testimonials',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    // Public: can submit testimonials
    create: () => true,
    // Admin/door_staff: read all for moderation
    // Public: read only approved testimonials
    read: ({ req: { user } }) => {
      if (user) return true
      return { approved: { equals: true } }
    },
    update: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    delete: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'text', type: 'textarea', required: true },
    { name: 'event', type: 'relationship', relationTo: 'events' },
    {
      name: 'approved',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Only approved testimonials are displayed publicly.' },
    },
    {
      name: 'anonymisedAt',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Timestamp when submitter PII was anonymised (DPIA-6). Set for rejected testimonials older than 30 days.',
      },
    },
  ],
}
