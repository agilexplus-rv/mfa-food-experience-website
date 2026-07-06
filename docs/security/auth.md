# Authentication && RBAC

> Phase 0.5 -- Auth + RBAC implementation
> Compliance: ADR-008 C4 (MFA/TOTP), C5 (rate limit/lockout), C6 (RBAC)

## Overview

The Malta Food Experience platform uses **Payload CMS v3 native authentication** (JWT/cookie sessions via HTTP-only payload-token cookie) for all three surfaces -- public, admin, and check-in -- as a single auth domain per ADR-007.

No NextAuth or external identity provider is used. Payload handles login, session management, password hashing, and role-based access control natively. This is the simpler, more secure path for a single-repo Next.js + Payload application.

## Auth mechanism

| Property | Value |
|----------|-------|
| Framework | Payload CMS v3 native auth |
| Token type | JWT, stored in HTTP-only cookie (payload-token) |
| Session expiry | Configurable via Payload auth.tokenExpiration (default Payload behavior) |
| API key support | Enabled (useAPIKey) for programmatic/script access |
| Password hashing | Bcrypt (Payload default) -- not custom |
| Password policy | minLength 12, uppercase, lowercase, digit, special character (enforced in src/lib/rbac/password.ts) |
| Login rate limiting | 5 attempts, 15-minute lockout (Payload auth config: maxLoginAttempts 5, lockTime 15min) |
| MFA (TOTP) | STUBBED -- field present, enforcement pending (see MFA section below) |

## MFA / TOTP -- enforcement status

Current state: STUBBED. MFA is NOT enforced.

| Component | Status |
|-----------|--------|
| mfaEnabled field (checkbox) on Users collection | Implemented |
| totpSecret field (encrypted text) on Users collection | Implemented (field exists; no encryption applied yet -- marked readOnly) |
| TOTP setup flow (QR code generation via otplib) | Not implemented |
| TOTP verification on login | Not implemented |
| Mandatory MFA on admin accounts | Stub only -- logs warnings on admin create/login without MFA |
| otplib dependency | Installed (v13.4.1, in package.json) |

Residual risk: Admin accounts currently operate without MFA. This is acceptable for Phase 0 development but MUST be resolved before production deployment (go-live gate per ADR-008). The stub fires console warnings on admin account creation and login -- these are visible in server logs.

To implement full MFA: Wire otplib into a Payload custom auth strategy or hook that:
1. Generates a TOTP secret on admin user creation, stores it encrypted in totpSecret
2. Requires MFA verification after password validation during login (via afterLogin or custom route)
3. Enforces that mfaEnabled must be true for all admin accounts (beforeChange hook enforcement, replacing current warning stub)

## Role-based access control

Two roles per FR-6.1:

| Role | Slug | Purpose |
|------|------|---------|
| Admin | admin | Full access to all collections, user management, bookings CRUD, content, coupons, audit logs |
| Door Staff | door_staff | Check-in only: read bookings (for scan context), update check-in status fields |

Default role on user creation: door_staff (role escalation requires an admin)

### Role matrix -- collection access

| Collection | Admin | Door Staff | Public (unauthenticated) |
|------------|-------|------------|--------------------------|
| Users | Full CRUD | Read/write own record only; cannot change role | None |
| Media | Full CRUD | Read-only | Read-only |
| Services | Full CRUD | Read-only | Read visible=true only |
| Events | Full CRUD | Read-only | Read status=scheduled only |
| Bookings | Full CRUD | Read + update checkIn fields only (field hook enforced) | Create only |
| SeatHolds | Read/delete/update | None | Create only (cart flow) |
| Coupons | Full CRUD | Read-only | None (server-side validation) |
| CouponRedemptions | Full CRUD | None | None |
| Testimonials | Full CRUD | Read-only (for moderation) | Create + read approved only |
| NewsItems | Full CRUD | Read-only | Read published=true only |
| Policies | Full CRUD | Read-only | Read-only |
| AuditLog | Read-only | None | None |

### Payload access control helpers

Available in src/lib/rbac/rbac.ts:

| Function | Purpose |
|----------|---------|
| isAdmin(user) | Returns true if user has admin role |
| isDoorStaff(user) | Returns true if user has door_staff role |
| isAuthenticated(user) | Returns true if user is logged in |
| canManageBookings(user) | Admin only |
| canCheckIn(user) | Admin or door_staff |
| canManageUsers(user) | Admin only |
| canAccessAuditLog(user) | Admin only |
| adminOnlyAccess({ req }) | Convenience access function: admin means true, else false |

## Route gating (Next.js middleware)

File: src/middleware.ts

| Route | Unauthenticated | Door-Staff | Admin |
|-------|----------------|------------|-------|
| /admin/login | Allowed | Allowed | Allowed |
| /admin/create-first-user | Allowed | Allowed | Allowed |
| /admin/forgot-password | Allowed | Allowed | Allowed |
| /admin/reset-password | Allowed | Allowed | Allowed |
| /api/* | Allowed | Allowed | Allowed |
| /admin/collections/bookings/* | Redirect to login | 403 Forbidden | Allowed |
| /admin/* (other) | Redirect to login | Allowed | Allowed |
| /check-in/* | Redirect to login | Allowed | Allowed |
| Public routes (/, /services, /events, etc.) | Allowed | Allowed | Allowed |

Middleware extracts the user role from the Payload JWT cookie (payload-token) without database hits. Payloads API layer re-verifies the token signature on every API call -- the middleware only does route-level gating.

## First-admin bootstrap

The seed script (src/payload/seed.ts, run via npm run db:seed) creates the first admin user from environment variables:

- ADMIN_BOOTSTRAP_EMAIL -- admin email
- ADMIN_BOOTSTRAP_PASSWORD -- admin password (must meet strength policy: 12+ chars, upper/lower/digit/symbol)

If both env vars are set and no users exist: the seed script creates the admin account.

If env vars are absent: the seed script prints instructions -- the first visitor to /admin can create the first user via Payloads built-in first-user creation flow. That user automatically becomes admin.

No passwords in code. .env.example contains sample entries with placeholder values.

### Payload native first-user flow

Payload CMS v3 has a built-in first-user creation flow: when the users collection is empty and an unauthenticated visitor navigates to /admin, Payload presents a Create First User form. The access control (create with totalDocs 0 check) allows this exactly once.

## Security headers baseline

Not yet implemented -- Phase 0.5 scope is auth/RBAC. Security headers (CSP, HSTS, X-Content-Type-Options, frame-ancestors) are tracked under ADR-008 C2 and will be added in a subsequent phase via src/app/security-headers.ts and next.config.ts.

## Audit trail

The audit_logs collection records admin actions. Create/update/delete events on all collections should be logged via Payload hooks (not yet implemented -- tracked as future work). The collection schema supports create, update, delete, export, login, and check_in event types.

## References

- ADR-008 Section C4-C6: MFA, rate limiting, RBAC
- FR-6.1 in user-requirements-v1.md: Role definitions
- src/lib/rbac/rbac.ts: Access control helpers
- src/lib/rbac/password.ts: Password strength validation
- src/middleware.ts: Route gating middleware
