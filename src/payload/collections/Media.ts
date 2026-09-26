import type { CollectionConfig } from 'payload'
import { auditLog, requestMeta } from '@/lib/audit/helper'

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
  hooks: {
    afterChange: [
      async ({ operation, doc, req }) => {
        try {
          const actor = req.user as { id?: string | number } | null
          if (!actor?.id) return
          const d = doc as { id: string | number; filename?: string; alt?: string }
          auditLog(req.payload, {
            action: operation === 'create' ? 'create' : 'update',
            actor: actor.id,
            collection: 'media',
            documentId: d.id,
            detail: `${operation === 'create' ? 'Uploaded' : 'Updated'} media "${d.filename || d.alt || d.id}"`,
            ...requestMeta(req),
          })
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
          const d = doc as { id: string | number; filename?: string; alt?: string }
          auditLog(req.payload, {
            action: 'delete',
            actor: actor.id,
            collection: 'media',
            documentId: d.id,
            detail: `Deleted media "${d.filename || d.alt || d.id}"`,
            ...requestMeta(req),
          })
        } catch {
          // audit failure must not block the primary operation
        }
      },
    ],
  },
  fields: [
    // alt is optional to avoid blocking uploads through relationship fields
    // (e.g. SiteSettings heroBackgroundImage) whose inline upload widget may
    // not expose the alt field. Admins should set alt text directly on the
    // media record for accessibility.
    { name: 'alt', type: 'text', required: false },
  ],
}
