# Authentication and Authorization — Malta Food Experience

## Auth mechanism

Payload CMS v3 native auth with JWT/cookie session — not NextAuth.

## Role matrix

| Collection | Admin | Door Staff | Public |
|---|---|---|---|
| Users | Full CRUD | Read/update own profile | First user only |
| Services | Full CRUD | Read only | visible=true only |
| Events | Full CRUD | Read only | scheduled only |
| Bookings | Full CRUD | checkIn fields only | create only |
| SeatHolds | Read | Denied | Create |
| Coupons | Full CRUD | Read only | Denied |
| CouponRedemptions | Full CRUD | Read only | Create |
| Testimonials | Full CRUD | Read only | Create + approved |
| NewsItems | Full CRUD | Read only | published only |
| Policies | Full CRUD | Read only | All |
| Media | Full CRUD | Read only | All |
| AuditLog | Read | Denied | Create |

## Password policy (C4)

- Min 12 chars, uppercase + lowercase + digit + special char required
- Enforced via beforeChange hook in Users.ts

## MFA / TOTP enforcement status (C4)

**STATUS: STUBBED — NOT ENFORCED**

- [x] mfaEnabled checkbox field
- [x] totpSecret text field
- [x] Console warnings on admin create/login without MFA
- [ ] TOTP setup flow — NOT IMPLEMENTED
- [ ] TOTP login verification — NOT IMPLEMENTED
- [ ] Blocking admin login without MFA — NOT IMPLEMENTED

Admin accounts CAN be created and used without MFA. The field and warnings exist as foundation for a future implementation phase. Must be completed before production deployment.

## Login rate limiting (C5)

- maxLoginAttempts: 5, lockTime: 15 minutes

## First-admin bootstrapping

1. Payload admin UI: first visitor at /admin becomes admin
2. Seed script: reads ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD from env
3. No real credentials in code

## Route gating

- Public paths: /admin/login, /admin/create-first-user, /admin/forgot-password, /admin/reset-password, /api/*
- Protected paths: /admin/* (authenticated), /check-in/* (authenticated)
- Admin only: /admin/collections/bookings/*

## Security headers

- HSTS max-age=1y, includeSubDomains, preload
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

## Residual risk (not covered)

- Full CSP not configured
- MFA not enforced
- No WAF/CDN rate limiting
- No session revocation from admin
- No CAPTCHA/Turnstile
- Check-in tool UI not built
