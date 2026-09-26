import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { validatePasswordStrength } from '@/lib/rbac/password'
import { actingAs } from '@/lib/audit/helper'
import { serverUrl } from '@/lib/env'

/**
 * Cryptographically random temporary password that always satisfies the
 * strength policy (>=12 chars, upper, lower, digit, symbol).
 */
function generateTempPassword(): string {
  const pick = (set: string) => set[crypto.randomInt(set.length)]
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%*?-'
  const all = upper + lower + digits + symbols
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)]
  while (chars.length < 16) chars.push(pick(all))
  // Fisher-Yates shuffle so the guaranteed classes aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  const pw = chars.join('')
  return validatePasswordStrength(pw).valid ? pw : generateTempPassword()
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const ROLES = ['admin', 'door_staff'] as const
type Role = (typeof ROLES)[number]

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

async function auth(req: NextRequest): Promise<{ id: string | number; email: string; role: string } | null> {
  const p = await payload()
  const user = await verifySession(req, p)
  if (!user || user.role !== 'admin') return null
  return user
}

export async function GET(req: NextRequest) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const p = await payload()
  const result = await p.find({
    collection: 'users',
    limit: 500,
    sort: 'createdAt',
    overrideAccess: true,
  })

  const users = result.docs.map((doc) => {
    const u = doc as Record<string, unknown>
    return {
      id: u.id,
      email: u.email,
      role: u.role || 'door_staff',
      mfaEnabled: u.mfaEnabled ?? false,
      active: u.active ?? true,
      createdAt: u.createdAt,
    }
  })

  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const p = await payload()

  let body: { email?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'valid email is required' }, { status: 400 })
  }
  const role: Role = ROLES.includes(body.role as Role) ? (body.role as Role) : 'door_staff'

  const existing = await p.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    return NextResponse.json({ error: 'user_already_exists' }, { status: 409 })
  }

  const tempPassword = generateTempPassword()

  const acting = actingAs(currentUser, req)
  try {
    await p.create({
      collection: 'users',
      data: {
        email,
        password: tempPassword,
        role,
        active: true,
      },
      overrideAccess: true,
      user: acting.user,
      // This route emails the temporary password itself; skip the
      // collection hook's set-your-own-password email.
      context: { ...acting.context, skipWelcomeEmail: true },
    })
  } catch (err) {
    console.error('[console/users] Create failed:', err)
    return NextResponse.json(
      { error: 'create_failed', detail: err instanceof Error ? err.message : undefined },
      { status: 500 },
    )
  }

  const roleLabel = role === 'admin' ? 'administrator' : 'door staff'
  const loginUrl = `${serverUrl()}/admin/login`
  let emailSent = true
  try {
    await p.sendEmail({
      to: email,
      subject: 'Welcome to Malta Food Experience — your staff account',
      html:
        '<div style="font-family:Montserrat,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#F9F4EF;border-radius:12px;color:#33483D">' +
        '<h1 style="font-size:1.25rem;margin:0 0 8px">Your staff account is ready</h1>' +
        `<p style="line-height:1.6">Hello,</p><p style="line-height:1.6">A ${roleLabel} account has been created for you on the Malta Food Experience platform.</p>` +
        `<p style="line-height:1.6"><strong>Login:</strong> ${escapeHtml(email)}<br><strong>Temporary password:</strong> <code style="font-size:1rem">${escapeHtml(tempPassword)}</code></p>` +
        `<a href="${loginUrl}" style="display:inline-block;padding:14px 32px;background:#33483D;color:#F9F4EF;font-weight:700;border-radius:8px;text-decoration:none;margin:16px 0">Log in</a>` +
        '<p style="line-height:1.6">For your security, please change this temporary password after your first login using the <strong>Change password</strong> link in the staff area.</p>' +
        '<hr style="border:none;border-top:1px solid #D4C8B8;margin:24px 0"><p style="color:#6B7F74;font-size:0.75rem">Malta Food Experience</p>' +
        '</div>',
    })
  } catch (emailErr) {
    emailSent = false
    console.warn('[console/users] Failed to send invite email:', emailErr)
  }

  return NextResponse.json({
    ok: true,
    email,
    role,
    emailSent,
    // Only surfaced to the inviting admin when the email could not be sent.
    tempPassword: emailSent ? undefined : tempPassword,
    message: emailSent
      ? `User created. A welcome email with a temporary password was sent to ${email}.`
      : 'User created, but the welcome email could not be sent. Share the temporary password securely.',
  })
}

export async function PATCH(req: NextRequest) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const p = await payload()

  let body: { id?: string | number; active?: boolean; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  if (String(body.id) === String(currentUser.id) && body.active === false) {
    return NextResponse.json({ error: 'cannot_deactivate_self' }, { status: 400 })
  }

  if (String(body.id) === String(currentUser.id) && body.role !== undefined && body.role !== 'admin') {
    return NextResponse.json({ error: 'cannot_demote_self' }, { status: 400 })
  }

  const data: { active?: boolean; role?: Role } = {}
  if (typeof body.active === 'boolean') data.active = body.active
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role as Role)) {
      return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
    }
    data.role = body.role as Role
  }

  try {
    await p.update({
      collection: 'users',
      id: Number(body.id),
      data,
      overrideAccess: true,
      ...actingAs(currentUser, req),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'update_failed' },
      { status: 400 },
    )
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const p = await payload()
  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const rawUserId = url.searchParams.get('userId')
  const userId = rawUserId && /^\d+$/.test(rawUserId) ? Number(rawUserId) : rawUserId

  if (!userId || !action) {
    return NextResponse.json({ error: 'userId and action query params required' }, { status: 400 })
  }

  if (action === 'reset-password') {
    const userRecord = await p.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
    })
    const record = userRecord as Record<string, unknown>
    const email = record.email as string | undefined
    if (!email) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
    }
    try {
      await p.forgotPassword({
        collection: 'users',
        data: { email },
        disableEmail: false,
      })
      await p.create({
        collection: 'audit_logs',
        data: {
          action: 'update',
          actor: currentUser.id,
          collection: 'users',
          documentId: String(userId),
          detail: `Admin-triggered password reset for user ${email}`,
        },
        overrideAccess: true,
      })
      return NextResponse.json({ ok: true, detail: `Password reset email sent to ${email}` })
    } catch (err) {
      return NextResponse.json(
        { error: 'Failed to send password reset email', detail: String(err) },
        { status: 500 },
      )
    }
  }

  if (action === 'reset-mfa') {
    const userRecord = await p.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
    })
    const record = userRecord as Record<string, unknown>
    const email = record.email as string | undefined
    if (!email) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
    }
    await p.update({
      collection: 'users',
      id: userId,
      data: { mfaEnabled: false, totpSecret: null },
      overrideAccess: true,
    })
    await p.create({
      collection: 'audit_logs',
      data: {
        action: 'mfa_reset',
        actor: currentUser.id,
        collection: 'users',
        documentId: String(userId),
        detail: `Admin-triggered MFA reset for user ${email} — MFA enrollment cleared, user must re-enroll at /mfa-setup`,
      },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, detail: `MFA reset for ${email}. User must re-enroll on next login.` })
  }

  if (action === 'delete') {
    if (String(userId) === String(currentUser.id)) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
    }
    try {
      // Users.beforeDelete also blocks self-deletion and removing the
      // last active admin; its error message is surfaced to the client.
      await p.delete({
        collection: 'users',
        id: userId,
        overrideAccess: true,
        ...actingAs(currentUser, req),
      })
      return NextResponse.json({ ok: true })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'delete_failed' },
        { status: 400 },
      )
    }
  }

  return NextResponse.json({ error: 'unknown action. Use action=reset-password, action=reset-mfa or action=delete' }, { status: 400 })
}
