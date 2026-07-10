import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'

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

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'valid email is required' }, { status: 400 })
  }

  const existing = await p.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    return NextResponse.json({ error: 'user_already_exists' }, { status: 409 })
  }

  const tempPassword = 'MFA' + Math.random().toString(36).slice(2, 10) + '!1'

  await p.create({
    collection: 'users',
    data: {
      email,
      password: tempPassword,
      role: 'door_staff',
      active: true,
    },
    overrideAccess: true,
  })

  try {
    await p.sendEmail({
      to: email,
      subject: 'Welcome to Malta Food Experience — Staff Account',
      html: '<p>Hello,</p><p>An admin account has been created for you on the Malta Food Experience platform.</p><p><strong>Login:</strong> ' + email + '<br><strong>Temporary password:</strong> ' + tempPassword + '</p><p>Please log in at the admin panel and change your password on first login.</p><p>— Malta Food Experience</p>',
    })
  } catch (emailErr) {
    console.warn('[console/users] Failed to send invite email:', emailErr)
  }

  return NextResponse.json({
    ok: true,
    email,
    tempPassword,
    message: 'User created. Share the temporary password securely.',
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

  let body: { id?: string | number; active?: boolean }
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

  await p.update({
    collection: 'users',
    id: body.id,
    data: { active: body.active },
    overrideAccess: true,
  })

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
  const userId = url.searchParams.get('userId')

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

  return NextResponse.json({ error: 'unknown action. Use action=reset-password or action=reset-mfa' }, { status: 400 })
}
