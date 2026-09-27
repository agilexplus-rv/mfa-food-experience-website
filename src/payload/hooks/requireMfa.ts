import { Forbidden, parseCookies } from 'payload'
import type {
  CollectionBeforeOperationHook,
  GlobalBeforeOperationHook,
  PayloadRequest,
} from 'payload'
import { MFA_VERIFIED_COOKIE, verifyMfaVerifiedToken } from '@/lib/mfa/session'

/**
 * Payload-level MFA gate (beforeOperation on every collection and global).
 *
 * middleware.ts only gates *pages*; Payload's own REST (/api/<slug>) and
 * GraphQL (/api/graphql) endpoints sit outside its matcher, so a
 * password-only `payload-token` (cookie or `Authorization: JWT ...` header)
 * could read and write every collection without a TOTP code. This hook
 * closes that hole inside Payload, after its auth strategies have resolved
 * req.user, so it covers both token transports.
 *
 * - overrideAccess === true: Local API calls (default true) from our own
 *   server code, which already enforces MFA via verifySession. REST, GraphQL
 *   and admin views pass undefined/false and are gated.
 * - Auth operations (login, forgot/reset password, refresh) must stay
 *   reachable before the second factor is presented.
 * - Anonymous requests are unaffected (public reads keep working).
 */

const AUTH_OPS = new Set(['login', 'forgotPassword', 'resetPassword', 'refresh'])

async function assertMfa(
  req: PayloadRequest,
  operation: string,
  overrideAccess?: boolean,
): Promise<void> {
  if (overrideAccess === true) return
  if (AUTH_OPS.has(operation)) return
  const u = req.user as {
    id?: string | number
    collection?: string
    mfaEnabled?: boolean
    role?: string
  } | null
  if (!u?.id || u.collection !== 'users') return
  if (u.mfaEnabled !== true) {
    // Admins must enrol first (mirrors the middleware /mfa-setup redirect).
    if (u.role === 'admin') throw new Forbidden(req.t)
    return
  }
  const ok = await verifyMfaVerifiedToken(
    parseCookies(req.headers).get(MFA_VERIFIED_COOKIE),
    String(u.id),
  )
  if (!ok) throw new Forbidden(req.t)
}

export const requireMfaCollection: CollectionBeforeOperationHook = async ({
  args,
  operation,
  overrideAccess,
  req,
}) => {
  await assertMfa(req, operation, overrideAccess)
  return args
}

export const requireMfaGlobal: GlobalBeforeOperationHook = async ({
  args,
  operation,
  overrideAccess,
  req,
}) => {
  await assertMfa(req, operation, overrideAccess)
  return args
}
