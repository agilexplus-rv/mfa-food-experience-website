import type { CollectionConfig } from 'payload'
import { auditLog, diffChanges } from '@/lib/audit/helper'

export const Waitlist: CollectionConfig = {
  slug: 'waitlist',
  admin: {
    useAsTitle: 'email',
  },
  access: {
    // Public: create their own waitlist entry
    create: () => true,
    // Only admin can read/update/delete
    read: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    update: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    delete: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
  },
  hooks: {
    afterChange: [
      async ({ operation, doc, previousDoc, req }) => {
        const actor = req.user as { id?: string | number } | null
        const d = doc as { id: string | number; email: string }
        if (operation === 'create') {
          auditLog(req.payload, { action: 'create', actor: actor?.id, collection: 'waitlist', documentId: d.id, detail: `Waitlist entry from ${d.email}` })
        } else if (operation === 'update' && actor?.id) {
          const changes = diffChanges((previousDoc as Record<string, unknown>) || {}, (doc as Record<string, unknown>) || {})
          auditLog(req.payload, { action: 'update', actor: actor.id, collection: 'waitlist', documentId: d.id, detail: `Updated waitlist entry ${d.email}`, changes })
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const actor = req.user as { id?: string | number } | null
        if (!actor?.id || !doc) return
        const d = doc as { id: string | number; email: string }
        auditLog(req.payload, { action: 'delete', actor: actor.id, collection: 'waitlist', documentId: d.id, detail: `Deleted waitlist entry ${d.email}` })
      },
    ],
  },
  fields: [
    {
      name: 'event',
      type: 'relationship',
      relationTo: 'events',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'persons',
      type: 'number',
      required: true,
      min: 1,
      defaultValue: 1,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Waiting', value: 'waiting' },
        { label: 'Notified', value: 'notified' },
        { label: 'Expired', value: 'expired' },
      ],
      defaultValue: 'waiting',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'notifiedAt',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Timestamp when the waitlist notification email was sent.',
      },
    },
  ],
}
