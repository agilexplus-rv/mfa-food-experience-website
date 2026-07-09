import type { CollectionConfig } from 'payload'

export const Policies: CollectionConfig = {
  slug: 'policies',
  admin: {
    useAsTitle: 'title',
  },
  timestamps: true,
  access: {
    create: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    read: () => true,
    update: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    delete: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'richText', required: true },
    {
      name: 'version',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Semantic version or revision label (e.g. "1.0", "v2.1").',
      },
    },
    {
      name: 'reviewedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayOnly' },
        description: 'Date this policy was last reviewed. Must be updated when content changes.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation, originalDoc }) => {
        if (operation === 'update' && data?.body && originalDoc) {
          const oldBody = JSON.stringify((originalDoc as { body?: unknown }).body)
          const newBody = JSON.stringify(data.body)
          if (oldBody !== newBody && !data.reviewedAt) {
            throw new Error(
              'Content has changed but reviewedAt was not updated. Please set the review date before saving.',
            )
          }
        }
        return data
      },
    ],
  },
}
