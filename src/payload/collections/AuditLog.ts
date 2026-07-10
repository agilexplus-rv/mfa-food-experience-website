import type { CollectionConfig } from 'payload'

export const AuditLog: CollectionConfig = {
  slug: 'audit_logs',
  admin: {
    useAsTitle: 'id',
  },
  access: {
    create: () => true,
    read: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'action', type: 'select',
      options: [
        { label: 'Create', value: 'create' },
        { label: 'Update', value: 'update' },
        { label: 'Delete', value: 'delete' },
        { label: 'Export', value: 'export' },
        { label: 'Login', value: 'login' },
        { label: 'Check-in', value: 'check_in' },
        { label: 'MFA Reset', value: 'mfa_reset' },
      ],
      required: true,
    },
    { name: 'actor', type: 'relationship', relationTo: 'users', required: true },
    { name: 'collection', type: 'text' },
    { name: 'documentId', type: 'text' },
    { name: 'detail', type: 'textarea' },
  ],
}
