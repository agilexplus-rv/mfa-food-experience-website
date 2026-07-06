import type { CollectionConfig } from 'payload'
import { validatePasswordStrength } from '@/lib/rbac/password'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000, // 15-minute lockout per ADR-008 C5
    useAPIKey: true  },
  admin: {
    useAsTitle: 'email',
  },
  access: {
    // First user (when zero users exist) can self-register.
    // After bootstrap, only admins can create users.
    // If the count query fails, DENY (fail closed).
    create: async ({ req }) => {
      try {
        const { totalDocs } = await req.payload.find({ collection: 'users', limit: 1 })
        // First user can always self-register
        if (totalDocs === 0) return true
        // Subsequent: only admins
        return (req.user as { role?: string } | null)?.role === 'admin'
      } catch {
        // Fail closed — a DB error must not open user creation
        return false
      }
    },
    // Authenticated users can read only their own record; admins can read all.
    read: ({ req: { user } }) => {
      if (!user) return false
      const u = user as { role?: string; id?: string }
      if (u.role === 'admin') return true
      // Non-admin users can only read their own record
      return { id: { equals: u.id } }
    },
    // Users can update their own non-role fields; admins can update anyone.
    // Role changes are protected by the beforeChange hook.
    update: ({ req: { user } }) => {
      if (!user) return false
      const u = user as { role?: string; id?: string }
      if (u.role === 'admin') return true
      // Non-admin can only update their own record
      return { id: { equals: u.id } }
    },
    delete: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Door Staff', value: 'door_staff' },
      ],
      defaultValue: 'door_staff',
      required: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'mfaEnabled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'C4: MFA/TOTP enforcement stub. Field exists; verification flow not yet implemented. See docs/security/auth.md.',
      },
    },
    {
      name: 'totpSecret',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'TOTP secret (encrypted at rest). Set via MFA setup flow.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        // Password strength validation
        const password = data?.password as string | undefined
        if (password) {
          // Skip validation on update if password hasn't changed
          if (operation === 'update' && originalDoc && password === originalDoc.password) {
            // Password unchanged — skip validation
          } else {
            const result = validatePasswordStrength(password)
            if (!result.valid) {
              throw new Error(
                'Weak password: ' + result.errors.join(' ')
              )
            }
          }
        }
        // Prevent non-admin users from changing their own role
        const roleChange = data?.role as string | undefined
        if (operation === 'update' && roleChange !== undefined) {
          const user = req.user as { role?: string } | null
          if (user?.role !== 'admin') {
            throw new Error('Only admins can change user roles.')
          }
        }
        return data
      },
      async ({ data, operation }) => {
        if (operation === 'create' && data?.role === 'admin' && !data?.mfaEnabled) {
          console.warn('[C4/MFA-STUB] Admin account created without MFA. See docs/security/auth.md.')
        }
        return data
      },
    ],
    afterLogin: [
      async ({ user }) => {
        const u = user as { role?: string; mfaEnabled?: boolean }
        if (u.role === 'admin' && !u.mfaEnabled) {
          console.warn('[C4/MFA-STUB] Admin logged in without MFA. See docs/security/auth.md.')
        }
      },
    ],
  },
}
