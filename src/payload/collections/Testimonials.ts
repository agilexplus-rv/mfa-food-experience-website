import type { CollectionConfig } from 'payload'

export const Testimonials: CollectionConfig = {
  slug: 'testimonials',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'text',
      type: 'textarea',
      required: true,
    },
    {
      name: 'event',
      type: 'relationship',
      relationTo: 'events',
    },
    {
      name: 'approved',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Only approved testimonials are displayed publicly.',
      },
    },
  ],
}
