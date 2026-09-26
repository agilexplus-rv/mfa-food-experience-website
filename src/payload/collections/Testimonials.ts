import type { CollectionConfig } from 'payload'
import { auditLog, diffChanges } from '@/lib/audit/helper'

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
  hooks: {
    afterChange: [
      async ({ operation, doc, previousDoc, req }) => {
        try {
          const actor = req.user as { id?: string | number } | null
          const d = doc as { id: string | number; name: string }
          if (operation === 'create') {
            auditLog(req.payload, { action: 'create', actor: actor?.id, collection: 'testimonials', documentId: d.id, detail: `Testimonial from "${d.name}"` })
          } else if (operation === 'update' && actor?.id) {
            const changes = diffChanges((previousDoc as Record<string, unknown>) || {}, (doc as Record<string, unknown>) || {})
            auditLog(req.payload, { action: 'update', actor: actor.id, collection: 'testimonials', documentId: d.id, detail: `Updated testimonial from "${d.name}"`, changes })
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
          auditLog(req.payload, { action: 'delete', actor: actor.id, collection: 'testimonials', documentId: d.id, detail: `Deleted testimonial from "${d.name}"` })
        } catch {
          // audit failure must not block the primary operation
        }
      },
    ],
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
