import type { CollectionConfig } from 'payload'
import { auditLog, diffChanges } from '@/lib/audit/helper'

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
    afterChange: [
      async ({ operation, doc, previousDoc, req }) => {
        try {
          const actor = req.user as { id?: string | number } | null
          if (!actor?.id) return
          const d = doc as { id: string | number; title: string; slug: string }
          if (operation === 'create') {
            auditLog(req.payload, { action: 'create', actor: actor.id, collection: 'policies', documentId: d.id, detail: `Created policy "${d.title}"` })
          } else if (operation === 'update') {
            const changes = diffChanges((previousDoc as Record<string, unknown>) || {}, (doc as Record<string, unknown>) || {})
            auditLog(req.payload, { action: 'update', actor: actor.id, collection: 'policies', documentId: d.id, detail: `Updated policy "${d.title}"`, changes })
          }
        } catch {
          // audit failure must not block the primary operation
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        try {
          const actor = req.user as { id?: string | number } | null
          if (!actor?.id || !doc) return
          const d = doc as { id: string | number; title: string }
          auditLog(req.payload, { action: 'delete', actor: actor.id, collection: 'policies', documentId: d.id, detail: `Deleted policy "${d.title}"` })
        } catch {
          // audit failure must not block the primary operation
        }
      },
    ],
  },
}
