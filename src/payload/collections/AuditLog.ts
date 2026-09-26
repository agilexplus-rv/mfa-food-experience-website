import type { CollectionConfig } from 'payload'

export const AuditLog: CollectionConfig = {
  slug: 'audit_logs',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['action', 'actor', 'collection', 'documentId', 'createdAt'],
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
        { label: 'Logout', value: 'logout' },
        { label: 'Check-in', value: 'check_in' },
        { label: 'MFA Reset', value: 'mfa_reset' },
        { label: 'Cancel', value: 'cancel' },
        { label: 'Duplicate', value: 'duplicate' },
      ],
      required: true,
    },
    { name: 'actor', type: 'relationship', relationTo: 'users', required: true },
    { name: 'collection', type: 'text' },
    { name: 'documentId', type: 'text' },
    { name: 'detail', type: 'textarea' },
    {
      name: 'ipAddress',
      type: 'text',
      admin: {
        description: 'Client IP address captured at the time of the action.',
        readOnly: true,
      },
    },
    {
      name: 'userAgent',
      type: 'text',
      admin: {
        description: 'Client User-Agent header at the time of the action.',
        readOnly: true,
      },
    },
    {
      name: 'changes',
      type: 'json',
      admin: {
        description: 'Before/after diff of changed fields (for update actions).',
        readOnly: true,
      },
    },
  ],
}
