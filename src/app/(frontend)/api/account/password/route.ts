import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { validatePasswordStrength } from '@/lib/rbac/password'
import { actingAs, auditLog, clientMeta } from '@/lib/audit/helper'
import { createRateLimiter } from '@/lib/rate-limit'

// Guards the current-password check against online guessing.
const rateLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 5 })

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * Same check Payload's local auth strategy performs
 * (payload/dist/auth/strategies/local/authenticate.js): PBKDF2-SHA256,
 * 25k iterations, 512-byte key, constant-time compare. Done directly so
 * verifying the current password doesn't create a login/audit entry.
 */
async function passwordMatches(password: string, salt: string, hash: string): Promise<boolean> {
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(password, salt, 25000, 512, 'sha256', (err, key) => (err ? reject(err) : resolve(key)))
  })
  const stored = Buffer.from(hash, 'hex')
  return derived.length === stored.length && crypto.timingSafeEqual(derived, stored)
}

/**
 * POST /api/account/password: any signed-in staff member (admin or
 * door staff) changes their OWN password.
 *
 * Body: { currentPassword, newPassword }
 */
export async function POST(req: NextRequest) {
  const p = await payload()
  const user = await verifySession(req, p)
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  rateLimiter.maybeCleanup()
  if (!rateLimiter.check(`user:${user.id}`)) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  let body: { currentPassword?: unknown; newPassword?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password are required.' }, { status: 400 })
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: 'The new password must be different from the current one.' }, { status: 400 })
  }
  const strength = validatePasswordStrength(newPassword)
  if (!strength.valid) {
    return NextResponse.json({ error: strength.errors.join(' ') }, { status: 400 })
  }

  const record = (await p.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
    showHiddenFields: true,
  })) as unknown as { salt?: string; hash?: string; email?: string }

  if (!record?.salt || !record?.hash || !(await passwordMatches(currentPassword, record.salt, record.hash))) {
    auditLog(p, {
      action: 'login_failed',
      actor: user.id,
      collection: 'users',
      documentId: user.id,
      detail: `Password change rejected for ${user.email}: current password incorrect`,
      ...clientMeta(req),
    })
    return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 400 })
  }

  try {
    // The Users collection hooks record the password_change audit entry.
    await p.update({
      collection: 'users',
      id: user.id,
      data: { password: newPassword },
      overrideAccess: true,
      ...actingAs(user, req),
    })
  } catch (err) {
    console.error('[account/password] Update failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Password change failed.' },
      { status: 400 },
    )
  }

  return NextResponse.json({ ok: true })
}
