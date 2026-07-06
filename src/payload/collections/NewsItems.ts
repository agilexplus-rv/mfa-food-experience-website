import type { CollectionConfig } from 'payload'

export const NewsItems: CollectionConfig = {
  slug: 'news_items',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    create: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    // Admin/door_staff: read all (door_staff for awareness)
    // Public: read only published items
    read: ({ req: { user } }) => {
      if (user) return true
      return { published: { equals: true } }
    },
    update: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    delete: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'date', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly' } } },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'body', type: 'richText', required: true },
    { name: 'published', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    { name: 'slug', type: 'text', required: true, unique: true, admin: { position: 'sidebar' } },
  ],
}
