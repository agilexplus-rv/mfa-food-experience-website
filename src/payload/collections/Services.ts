import type { CollectionConfig } from 'payload'
import { auditLog, diffChanges } from '@/lib/audit/helper'

export const Services: CollectionConfig = {
  slug: 'services',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    create: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    // Admin/door_staff: read all (door_staff needs service context for check-in)
    // Public: read only visible services
    read: ({ req: { user } }) => {
      if (user) return true
      return { visible: { equals: true } }
    },
    update: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    delete: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
  },
  hooks: {
    afterChange: [
      async ({ operation, doc, previousDoc, req }) => {
        try {
          const actor = req.user as { id?: string | number } | null
          if (!actor?.id) return
          const d = doc as { id: string | number; name: string }
          if (operation === 'create') {
            auditLog(req.payload, { action: 'create', actor: actor.id, collection: 'services', documentId: d.id, detail: `Created service "${d.name}"` })
          } else if (operation === 'update') {
            const changes = diffChanges((previousDoc as Record<string, unknown>) || {}, (doc as Record<string, unknown>) || {})
            auditLog(req.payload, { action: 'update', actor: actor.id, collection: 'services', documentId: d.id, detail: `Updated service "${d.name}"`, changes })
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
          const d = doc as { id: string | number; name: string }
          auditLog(req.payload, { action: 'delete', actor: actor.id, collection: 'services', documentId: d.id, detail: `Deleted service "${d.name}"` })
        } catch {
          // audit failure must not block the primary operation
        }
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'visible',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'FR-1.2: When unchecked, this service and its events are hidden from the public site.',
      },
    },
    {
      name: 'imagery',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
