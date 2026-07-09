import type { CollectionConfig } from 'payload'
import { validatePasswordStrength } from '@/lib/rbac/password'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000, // 15-minute lockout per ADR-008 C5
    useAPIKey: true,
  },
  admin: {
    useAsTitle: 'email',
  },
  access: {
    // First user (when zero users exist) can self-register.
    // After bootstrap, only admins can create users.
    // If the count query fails, DENY (fail closed).
    create: async ({ req }) => {
      try {
        const { totalDocs } = await req.payload.find({
          collection: 'users',
          limit: 1,
        })
        if (totalDocs === 0) return true
        return (req.user as { role?: string } | null)?.role === 'admin'
      } catch {
        return false
      }
    },
    read: ({ req: { user } }) => {
      if (!user) return false
      const u = user as { role?: string; id?: string }
      if (u.role === 'admin') return true
      return { id: { equals: u.id } }
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      const u = user as { role?: string; id?: string }
      if (u.role === 'admin') return true
      return { id: { equals: u.id } }
    },
    delete: ({ req: { user } }) =>
      (user as { role?: string } | null)?.role === 'admin',
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
      // Required so middleware.ts can read the role directly off the
      // payload-token JWT without a database hit (see getPayloadFromToken()).
      // Without this, Payload never embeds `role` into the JWT, so every
      // authenticated user -- including admins -- falls through to
      // middleware's `payload.role || 'door_staff'` fallback and gets
      // treated as door_staff, incorrectly blocked from /console and other
      // admin-only paths. This was a real production bug (all admins locked
      // out of /console) fixed 2026-07-09.
      saveToJWT: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'mfaEnabled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'Two-factor authentication (TOTP). Enable after completing setup at /mfa-setup.',
      },
      saveToJWT: true,
    },
    {
      name: 'totpSecret',
      type: 'text',
      saveToJWT: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description:
          'TOTP secret (AES-256-GCM encrypted at rest). Set via MFA setup flow. Never exposed in JWT.',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      saveToJWT: true,
      admin: {
        position: 'sidebar',
        description: 'Deactivated users cannot log in. Use this instead of deleting accounts.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        // Password strength validation
        const password = data?.password as string | undefined
        if (password) {
          if (
            operation === 'update' &&
            originalDoc &&
            password === originalDoc.password
          ) {
            // Password unchanged — skip validation
          } else {
            const result = validatePasswordStrength(password)
            if (!result.valid) {
              throw new Error('Weak password: ' + result.errors.join(' '))
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
        // C4/MFA-ENFORCED: Warn on admin creation without MFA (info only —
        // the real gate is the middleware mfa-verified cookie check).
        if (operation === 'create' && data?.role === 'admin' && !data?.mfaEnabled) {
          console.info(
            '[MFA] Admin account created without MFA enabled. User will see a setup prompt in the admin panel.',
          )
        }
        return data
      },
    ],
    afterLogin: [
      async ({ user }) => {
        const u = user as { role?: string; mfaEnabled?: boolean }
        if (u.role === 'admin' && !u.mfaEnabled) {
          console.info(
            '[MFA] Admin logged in without MFA enabled. Middleware will not block; frontend banner prompts setup.',
          )
        }
      },
    ],
  },
}
