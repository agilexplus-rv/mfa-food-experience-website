import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: 'public/storage',
    mimeTypes: ['image/*'],
  },
  admin: {
    useAsTitle: 'alt',
  },
  access: {
    create: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    read: () => true,
    update: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    delete: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
  },
  fields: [
    // alt is optional to avoid blocking uploads through relationship fields
    // (e.g. SiteSettings heroBackgroundImage) whose inline upload widget may
    // not expose the alt field. Admins should set alt text directly on the
    // media record for accessibility.
    { name: 'alt', type: 'text', required: false },
  ],
}
