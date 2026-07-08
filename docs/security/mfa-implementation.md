# MFA / TOTP implementation

> Phase 4.3 -- MFA/TOTP enforcement
> Replaces [C4/MFA-STUB] stubs in Users.ts with real TOTP verification.
> Compliance: ADR-008 C4 (mandatory MFA), DPIA #4.

## Architecture

**Chosen approach:** Middleware-based MFA gate with custom API routes and standalone pages. Payload's native login form is untouched -- all existing theming (AdminLogo, AdminPasswordReveal, AdminThemeStyles) remains intact.

### Why not a custom auth strategy?

Payload v3's `loginOperation` (node_modules/payload/dist/auth/operations/login.js) performs password verification, JWT signing, and session cookie setting in a single hardcoded function. The `beforeLogin` hook runs AFTER password verification but JUST BEFORE JWT signing -- throwing an error there would block login but can't return a "partial login, come back with TOTP code" response. The `afterLogin` hook runs after the JWT is already issued -- too late.

Custom auth strategies exist in Payload's API but are designed for replacing the local credential check (e.g. SSO/OAuth), not for adding a second factor. Implementing a genuine two-step login inside Payload's login pipeline would require replacing the entire login operation -- an invasive change that blocks future Payload upgrades.

### What we built instead

1. **Middleware gate** (`src/middleware.ts`): After a successful password login, Payload issues its normal JWT cookie (`payload-token`). The JWT includes `mfaEnabled` (set `saveToJWT: true` on the Users field). Middleware checks: if `mfaEnabled=true` in the JWT but no `mfa-verified` cookie exists, redirect to `/mfa-verify`. Users without MFA enabled proceed normally.

2. **MFA verification page** (`src/app/(frontend)/mfa-verify/page.tsx`): A standalone page with brand-styled 6-digit code input. Posts the code to `/api/mfa/verify-login`, which verifies the TOTP and sets the `mfa-verified` HttpOnly cookie.

3. **Enrollment flow** (`src/app/(frontend)/mfa-setup/page.tsx`): A standalone setup page available at `/mfa-setup`. Users (must already be logged in) visit this page, which:
   - Calls `POST /api/mfa/enroll` to generate a TOTP secret, store it encrypted, and return a QR-code URI
   - Displays the QR code using the `qrcode` package
   - Accepts a 6-digit verification code via `POST /api/mfa/verify-setup` to confirm the authenticator is working before setting `mfaEnabled=true`

4. **Admin banner** (`src/components/admin/MfaSetupBanner.tsx`): A 'use client' component registered in `payload.config.ts`'s `admin.components.header` slot. Reads the user's `mfaEnabled` from the JWT cookie on the client side. If the user is an admin without MFA enabled, shows a prominent terracotta banner with a link to `/mfa-setup`.

### Enforcement posture

**Progressive enforcement (not hard cutoff).** This implementation gates admin access behind MFA for any account that HAS enabled it (`mfaEnabled=true`) -- those users cannot reach `/admin/*` without completing TOTP verification. Accounts that haven't enabled MFA yet can still log in with password-only, but see a persistent banner prompting them to set it up.

**Why not hard enforcement now?**
- The existing admin account in production may not have MFA set up yet.
- Locking admins out before they've had a chance to set up their authenticator app would require direct database access to fix.
- Once the admin visits `/mfa-setup` and verifies their authenticator, they're fully covered.
- A future follow-up (e.g. a `beforeChange` hook that blocks admin role assignment unless `mfaEnabled=true`) could harden this to mandatory.

## Implementation details

### TOTP library

Uses `otplib` v13.4.1 (already a dependency). Specifically:
- `TOTP` class from `otplib` with `NobleCryptoPlugin` (pure JS, no native deps) and `ScureBase32Plugin`
- 6-digit codes, 30-second period, SHA-1 algorithm (max authenticator compatibility)
- `epochTolerance: 30` seconds -- accepts codes within +/- 1 time window for clock drift

### Secret encryption

- Algorithm: AES-256-GCM (authenticated encryption with associated data)
- Key derivation: SHA-256 of `PAYLOAD_SECRET` (already a cryptographically random value -- no salt/scrypt needed since the input is not a password)
- Format: IV (12 bytes) + Auth Tag (16 bytes) + Ciphertext, packed as URL-safe base64
- Implementation: `src/lib/mfa/encryption.ts`

### Session tokens

- MFA verified token: JWT (HS256) stored in `mfa-verified` HttpOnly cookie, 24-hour expiry
- Token encodes `{ sub: userId, mfa: true }`
- Signing key: `PAYLOAD_SECRET`
- Implementation: `src/lib/mfa/session.ts`

### JWT field considerations

- `mfaEnabled` field: `saveToJWT: true` so middleware can read it without a DB query
- `totpSecret` field: `saveToJWT: false` -- never exposed in the JWT; only accessible server-side via direct DB queries with `overrideAccess: true`

## API routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/mfa/enroll` | POST | Session | Generate TOTP secret, return QR URI |
| `/api/mfa/verify-setup` | POST | Session | Verify TOTP code, enable MFA on account |
| `/api/mfa/verify-login` | POST | JWT cookie | Verify TOTP code, set mfa-verified cookie |

All routes perform full JWT signature verification (via `jose`'s `jwtVerify`) or reuse the existing `verifySession` helper from `src/lib/rbac/verify-session.ts`.

## Files changed/created

### Created
- `src/lib/mfa/encryption.ts` -- AES-256-GCM encrypt/decrypt for TOTP secrets
- `src/lib/mfa/session.ts` -- MFA verified token creation & cookie config
- `src/lib/mfa/totp.ts` -- otplib wrapper (secret generation, URI building, verification)
- `src/app/(frontend)/api/mfa/enroll/route.ts` -- enrollment API
- `src/app/(frontend)/api/mfa/verify-setup/route.ts` -- setup verification API
- `src/app/(frontend)/api/mfa/verify-login/route.ts` -- login-time MFA verification API
- `src/app/(frontend)/mfa-setup/page.tsx` -- MFA setup page (QR code + enrollment)
- `src/app/(frontend)/mfa-verify/page.tsx` -- MFA verification page (post-login)
- `src/components/admin/MfaSetupBanner.tsx` -- admin panel banner for unconfigured MFA
- `docs/security/mfa-implementation.md` -- this file

### Modified
- `src/payload/collections/Users.ts` -- replaced C4/MFA-STUB stubs; added `saveToJWT` flags; updated field descriptions
- `payload.config.ts` -- added MfaSetupBanner to admin.components.header
- `src/app/(payload)/admin/importMap.js` -- registered MfaSetupBanner
- `src/middleware.ts` -- added MFA gating logic

## Testing / verification

### What can be verified in this environment
- `npx tsc --noEmit` exits 0 (confirmed).
- All new files read back correctly (confirmed via read_file).

### What needs human end-to-end testing
1. **Enrollment flow:** Log in as an admin, navigate to `/mfa-setup`, scan the QR code with Google Authenticator / Authy, enter the 6-digit code. Verify that `mfaEnabled` is set to `true` on the user record in the Payload admin.
2. **Login MFA gate:** Log out, log back in. After entering password, you should be redirected to `/mfa-verify`. Enter a valid TOTP code, verify you're redirected to `/admin` and can access admin pages. Enter an invalid code, verify you see an error and stay on the verify page.
3. **Middleware bypass check:** After completing MFA verification, navigate directly to `/admin` -- should work. Clear the `mfa-verified` cookie via browser dev tools, refresh -- should redirect to `/mfa-verify`.
4. **Banner display:** Log in as an admin WITHOUT MFA enabled. Verify the terracotta banner appears at the top of all admin pages.
5. **Door staff exemption:** Log in as a door_staff user (no mfaEnabled). Verify they can access admin pages without MFA prompts.
6. **TOTP secret encryption:** Check the database directly -- the `totpSecret` field should contain a long base64url string, not a human-readable Base32 key.
