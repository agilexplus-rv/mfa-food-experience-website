import type { CollectionConfig } from 'payload'
import { auditLog, diffChanges } from '@/lib/audit/helper'

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
  hooks: {
    afterChange: [
      async ({ operation, doc, previousDoc, req }) => {
        const actor = req.user as { id?: string | number } | null
        if (!actor?.id) return
        const d = doc as { id: string | number; title: string }
        if (operation === 'create') {
          auditLog(req.payload, { action: 'create', actor: actor.id, collection: 'news_items', documentId: d.id, detail: `Created article "${d.title}"` })
        } else if (operation === 'update') {
          const changes = diffChanges((previousDoc as Record<string, unknown>) || {}, (doc as Record<string, unknown>) || {})
          auditLog(req.payload, { action: 'update', actor: actor.id, collection: 'news_items', documentId: d.id, detail: `Updated article "${d.title}"`, changes })
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const actor = req.user as { id?: string | number } | null
        if (!actor?.id || !doc) return
        const d = doc as { id: string | number; title: string }
        auditLog(req.payload, { action: 'delete', actor: actor.id, collection: 'news_items', documentId: d.id, detail: `Deleted article "${d.title}"` })
      },
    ],
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
