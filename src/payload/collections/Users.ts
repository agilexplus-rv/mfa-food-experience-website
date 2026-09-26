import type { CollectionConfig } from 'payload'
import { validatePasswordStrength } from '@/lib/rbac/password'
import { auditLog, diffChanges } from '@/lib/audit/helper'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // Drizzle transactions on Azure Postgres hang when running DB operations
    // inside initTransaction: findOne, updateOne, create, etc. The root cause
    // is a Drizzle/PG driver incompat with Azure managed Postgres sslmode=require.
    //
    // We disable ALL intra-transaction DB writes:
    //   - maxLoginAttempts: 0     → skip lock-check findOne + resetLoginAttempts
    //   - useSessions: false      → skip addSessionToUser updateOne inside tx
    //
    // The afterLogin audit_log create is fire-and-forget so it runs outside
    // the transaction (payload.create with a fresh req context).
    //
    // Without these, hung transactions exhaust the DB pool within minutes.
    // TODO: re-enable lockout, sessions, and await audit_log after fixing
    //       the Drizzle transaction issue.
    maxLoginAttempts: 0,
    lockTime: 15 * 60 * 1000,
    useAPIKey: false,
    useSessions: false,
    forgotPassword: {
      generateEmailSubject: () =>
        'Malta Food Experience — Reset your password',
      generateEmailHTML: (args) => {
        const token = args?.token ?? ''
        const user = args?.user as { email?: string } | undefined
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
        return (
          '<div style="font-family:Montserrat,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#F9F4EF;border-radius:12px">' +
          '<h1 style="color:#33483D;font-size:1.25rem;margin:0 0 8px">Password Reset</h1>' +
          '<p style="color:#33483D;line-height:1.6">Hello ' + (user?.email || '') + ',</p>' +
          '<p style="color:#33483D;line-height:1.6">A password reset was requested for your Malta Food Experience account. Click the button below to set a new password. This link expires in 1 hour.</p>' +
          '<a href="' + baseUrl + '/admin/reset?token=' + token + '" style="display:inline-block;padding:14px 32px;background:#33483D;color:#F9F4EF;font-weight:700;border-radius:8px;text-decoration:none;margin:16px 0">Reset Password</a>' +
          '<p style="color:#6B7F74;font-size:0.875rem;line-height:1.5">If you did not request this, you can safely ignore this email.</p>' +
          '<hr style="border:none;border-top:1px solid #D4C8B8;margin:24px 0">' +
          '<p style="color:#6B7F74;font-size:0.75rem">Malta Food Experience</p>' +
          '</div>'
        )
      },
    },
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
      // Only admins may toggle this via the REST/admin API; otherwise a user
      // could PATCH their own record with { mfaEnabled: false } to disable
      // 2FA. The MFA routes write it with overrideAccess: true.
      access: {
        update: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
      },
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
      access: {
        read: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
        update: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
      },
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
        // Prevent non-admin users from changing their own role.
        const roleChange = data?.role as string | undefined
        if (
          operation === 'update' &&
          roleChange !== undefined &&
          originalDoc &&
          roleChange !== originalDoc.role
        ) {
          const user = req.user as { role?: string } | null
          if (user?.role !== 'admin') {
            throw new Error('Only admins can change user roles.')
          }
        }

        // Prevent an admin from removing their own admin role or deactivating themselves.
        if (operation === 'update' && originalDoc && req.user) {
          const userId = (req.user as { id?: string | number }).id
          const origId = (originalDoc as { id?: string | number }).id
          const origRole = (originalDoc as { role?: string }).role
          if (String(userId) === String(origId)) {
            // Admin cannot deactivate or demote themselves
            if (origRole === 'admin' && data?.role !== undefined && data.role !== 'admin') {
              throw new Error('You cannot remove your own admin role.')
            }
            if (data?.active === false) {
              throw new Error('You cannot deactivate your own account.')
            }
          }
        }

        // C4/MFA-ENFORCED: Warn on admin creation without MFA
        if (operation === 'create' && data?.role === 'admin' && !data?.mfaEnabled) {
          console.info(
            '[MFA] Admin account created without MFA enabled. User will see a setup prompt in the admin panel.',
          )
        }
        return data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const user = req.user as { id?: string | number; role?: string } | null

        // Prevent admin from deleting themselves
        if (user && String(user.id) === String(id)) {
          throw new Error('You cannot delete your own account.')
        }

        // Prevent deleting the last admin
        try {
          const { docs } = await req.payload.find({
            collection: 'users',
            where: {
              and: [
                { role: { equals: 'admin' } },
                { id: { not_equals: id } },
              ],
            },
            limit: 1,
            overrideAccess: true,
          })

          if (docs.length === 0) {
            throw new Error('Cannot delete the last admin. At least one admin user must exist.')
          }
        } catch (err) {
          if (err instanceof Error && err.message.startsWith('Cannot delete')) throw err
          // If the query itself fails (DB issue), deny to be safe
          throw new Error('Unable to verify admin count — deletion blocked.')
        }
      },
    ],
    afterChange: [
      async ({ operation, doc, previousDoc, req }) => {
        const actor = req.user as { id?: string | number; email?: string } | null
        const d = doc as { id: string | number; email: string; role: string }
        const email = d.email || '(no email)'

        if (operation === 'create') {
          auditLog(req.payload, {
            action: 'create',
            actor: actor?.id,
            collection: 'users',
            documentId: d.id,
            detail: `Created user "${email}" (role: ${d.role})`,
          })

          // Send a forgot-password email so the new user can set their own
          // password. Fire-and-forget: don't block user creation on email delivery.
          void (async () => {
            try {
              await req.payload.forgotPassword({
                collection: 'users',
                data: { email: d.email },
              })
            } catch (err) {
              console.error('[Users] Failed to send password-set email:', err)
            }
          })()
        } else if (operation === 'update') {
          const prev = (previousDoc || {}) as Record<string, unknown>
          const curr = (doc || {}) as Record<string, unknown>
          const changes = diffChanges(prev, curr)

          // Detect password changes for audit
          if (curr.password && prev.password !== curr.password) {
            const pwChange = { ...changes, password: 'changed' }
            auditLog(req.payload, {
              action: 'update',
              actor: actor?.id,
              collection: 'users',
              documentId: d.id,
              detail: `Password changed for user "${email}"`,
              changes: pwChange,
            })
          } else {
            auditLog(req.payload, {
              action: 'update',
              actor: actor?.id,
              collection: 'users',
              documentId: d.id,
              detail: `Updated user "${email}"`,
              changes,
            })
          }
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const actor = req.user as { id?: string | number } | null
        if (!actor?.id || !doc) return
        const d = doc as { id: string | number; email: string; role: string }
        auditLog(req.payload, {
          action: 'delete',
          actor: actor.id,
          collection: 'users',
          documentId: d.id,
          detail: `Deleted user "${d.email || '(no email)'}" (role: ${d.role})`,
        })
      },
    ],
    afterLogin: [
      async ({ user, req }) => {
        const u = user as { role?: string; mfaEnabled?: boolean; id?: string | number; email?: string }

        // Write a 'login' entry to the audit log (fire-and-forget).
        auditLog(req.payload, {
          action: 'login',
          actor: u.id,
          collection: 'users',
          documentId: String(u.id ?? ''),
          detail: `User ${u.email || '(unknown)'} logged in (role: ${u.role || 'unknown'})`,
        })

        if (u.role === 'admin' && !u.mfaEnabled) {
          console.info(
            `[MFA] Admin user ${u.id} logged in without MFA. Redirecting to /mfa-setup for enrollment.`,
          )
          return { redirectTo: '/mfa-setup' }
        }
        // After login, redirect to the custom dashboard
        return { redirectTo: '/console' }
      },
    ],
    afterLogout: [
      async ({ req }) => {
        const user = req.user as { id?: string | number; email?: string } | null
        if (!user?.id) return
        auditLog(req.payload, {
          action: 'logout',
          actor: user.id,
          collection: 'users',
          documentId: String(user.id),
          detail: `User ${user.email || '(unknown)'} logged out`,
        })
      },
    ],
  },
}
