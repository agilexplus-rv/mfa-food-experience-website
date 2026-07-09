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

/**
 * GET /admin-tools/api/users
 * Admin-only. Returns all users with basic info (no secrets).
 */
export async function GET(req: NextRequest) {
  const p = await payload()

  const user = await verifySession(req, p)
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const result = await p.find({
    collection: 'users',
    limit: 500,
    sort: 'createdAt',
    overrideAccess: true,
  })

  const users = result.docs.map((doc) => {
    const u = doc as {
      id: string | number
      email: string
      role: string
      mfaEnabled?: boolean
      active?: boolean
      createdAt: string
    }
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

/**
 * POST /admin-tools/api/users
 * Admin-only. Creates a new user (invite flow).
 */
export async function POST(req: NextRequest) {
  const p = await payload()

  const currentUser = await verifySession(req, p)
  if (!currentUser) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

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

  // Check for existing user
  const existing = await p.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    return NextResponse.json({ error: 'user_already_exists' }, { status: 409 })
  }

  // Generate a temporary password
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

  // Try to send invite email (best-effort)
  try {
    await p.sendEmail({
      to: email,
      subject: 'Welcome to Malta Food Experience — Staff Account',
      html: `<p>Hello,</p>
<p>An admin account has been created for you on the Malta Food Experience platform.</p>
<p><strong>Login:</strong> ${email}<br>
<strong>Temporary password:</strong> ${tempPassword}</p>
<p>Please log in at the admin panel and change your password on first login.</p>
<p>— Malta Food Experience</p>`,
    })
  } catch (emailErr) {
    console.warn('[admin-tools/users] Failed to send invite email:', emailErr)
  }

  return NextResponse.json({
    ok: true,
    email,
    tempPassword,
    message: 'User created. Share the temporary password securely.',
  })
}

/**
 * PATCH /admin-tools/api/users
 * Admin-only. Toggle active status.
 */
export async function PATCH(req: NextRequest) {
  const p = await payload()

  const currentUser = await verifySession(req, p)
  if (!currentUser) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { id?: string | number; active?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // Prevent self-deactivation
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
