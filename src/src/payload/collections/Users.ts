import type { CollectionConfig } from 'payload'
import { validatePasswordStrength } from '@/lib/rbac/password'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000, // 15-minute lockout per ADR-008 C5
    useAPIKey: false,
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
        // Prevent non-admin users from changing their own role.
        //
        // ROOT CAUSE of the 2026-07-12 "Failed to store TOTP secret"
        // bug: Payload's beforeChange hook receives the FULL MERGED
        // document for update operations -- data.role is the user's
        // EXISTING role on every single update, whether or not role
        // was part of the fields actually being changed. The previous
        // `data?.role !== undefined` check therefore fired on every
        // update to any user record (any update always has a role
        // present in the merged data), not just genuine role-change
        // attempts. This tripped /api/mfa/enroll's payload.update()
        // call (which only sends { totpSecret }, never role) because
        // that Local API call also has no req.user (it uses
        // overrideAccess: true rather than an authenticated request
        // context), so `user?.role !== 'admin'` was also always true
        // -- confirmed via a temporary diagnostic route reproducing
        // the exact call and surfacing the underlying error message
        // ("Only admins can change user roles.") instead of the
        // generic 500 the enroll route's catch-all wraps it in.
        //
        // Fix: compare against originalDoc.role to detect an ACTUAL
        // change, not mere presence -- this is what should have been
        // checked from the start.
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
      async ({ user, req }) => {
        const u = user as { role?: string; mfaEnabled?: boolean; id?: string | number; email?: string }

        // Write a 'login' entry to the audit log. This runs server-side
        // in Payload's afterLogin hook, so we have the full req.payload
        // Local API available. Uses overrideAccess: true because the
        // audit_logs collection's create access is () => true anyway,
        // but we want to ensure the write succeeds even if access
        // rules change later.
        //
        // ROOT CAUSE of "missing login/logout in audit log": this hook
        // previously ONLY did a console.info for MFA warnings and never
        // wrote an audit_logs entry. Login events were never persisted.
        try {
          await req.payload.create({
            collection: 'audit_logs',
            overrideAccess: true,
            data: {
              action: 'login',
              actor: u.id,
              collection: 'users',
              documentId: String(u.id ?? ''),
              detail: `User ${u.email || '(unknown)'} logged in (role: ${u.role || 'unknown'})`,
            },
          })
        } catch (err) {
          // Best-effort: do not block login if audit-log write fails.
          console.error('[AuditLog] Failed to write login entry:', err)
        }

        if (u.role === 'admin' && !u.mfaEnabled) {
          console.info(
            `[MFA] Admin user ${u.id} logged in without MFA. Redirecting to /mfa-setup for enrollment.`,
          )
          return { redirectTo: '/mfa-setup' }
        }
      },
    ],
  },
}
