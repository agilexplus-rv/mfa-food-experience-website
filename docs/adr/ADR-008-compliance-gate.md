# ADR-008: Compliance Gate

## Status
Accepted

## Context
The Malta Food Experience booking platform operates under a binding set of compliance requirements spread across three annexes of the URD v1.1:

- **Annex A** — DPIA v1.0: privacy-by-design measures (Sec 6, 10 measures)
- **Annex B** — Cybersecurity Risk Assessment v1.0: 17 threat scenarios; 20 controls (C1–C20); pre-go-live security checklist (9 items)
- **Annex C** — EU & Malta Legal Compliance Memo v1.0: 12 consolidated compliance actions

Additionally, the quote (QT-07042026-MFA) includes a contractual undertaking to comply with the **MITA Website Policy (GMICT P 0051)** for the Maltese public sector.

These requirements are binding. Compliance must be a **build requirement, not an afterthought** — every control, measure, and action must have a concrete implementation target (file, module, or configuration) traceable from this ADR. A downstream worker or auditor must be able to read this document and verify implementation by inspecting the named targets.

## Options Considered

This ADR does not present competing architectural options — compliance mapping is prescriptive by nature. The decision space was: treat compliance as a post-build audit (Option A — require downstream workers to discover and implement controls from source documents independently) versus embed compliance as a build-time gate with concrete implementation targets per control (Option B). Option A risks controls being missed, implemented inconsistently, or deferred. Option B makes compliance traceable, verifiable, and a CI-enforced build requirement from day one.
## Decision
**Compliance-by-design: every control and measure maps to a concrete implementation target. The pre-go-live security checklist gates production deployment.**

### C1–C20: Implementation targets

| Control | Description | Implementation target |
|---|---|---|
| C1 | Parameterised queries / ORM; server-side input validation | Payload collections + Drizzle ORM (parameterised); Zod schemas on all API routes: `src/lib/validations/*.ts` |
| C2 | Output encoding + CSP; sanitise rich text | Next.js headers config: `src/app/security-headers.ts`; Payload rich text rendered via lexical renderer with output encoding; CSP in `next.config.ts` including Stripe + Google Translate domains |
| C3 | Testimonials/news rendered as text (no raw HTML) | Payload `afterRead` hooks strip raw HTML from user-submitted fields: `src/payload/hooks/sanitizeHtml.ts` |
| C4 | MFA (TOTP) mandatory on all admin accounts; strong password policy | Payload auth config: `src/payload/auth.config.ts` — TOTP enforcement, password complexity rules |
| C5 | Login rate limiting + lockout; admin panel not linked from public site | Rate limiting middleware: `src/app/middleware/rate-limit.ts` (admin routes); no admin links in public navigation |
| C6 | RBAC: Admin vs Door-staff; least privilege; audit log | Payload access control: `src/payload/access/*.ts`; audit log collection: `src/payload/collections/AuditLog.ts` |
| C7 | Stripe webhook signature verification; idempotency; amount re-verification | `src/app/api/webhooks/stripe/route.ts` — signature verification, idempotency via `stripe_events` table, amount check |
| C8 | DB-level transactional seat allocation; cart holds expire server-side | ADR-002 implementation: `src/lib/bookings/seat-holds.ts` + `src/lib/cron/sweep-holds.ts` |
| C9 | QR = random >= 128-bit token; single-use; authenticated + rate-limited | ADR-003 implementation: `src/lib/qr/token.ts`; `src/app/api/check-in/route.ts` |
| C10 | Coupon codes high-entropy; limits enforced server-side; usage audit | ADR-005 implementation: `src/lib/coupons/validate.ts`; `src/payload/collections/Coupons.ts`; `src/payload/collections/CouponRedemptions.ts` |
| C11 | CDN/WAF; rate limits on booking + coupon endpoints | Deployment config: `vercel.json` or Cloudflare WAF rules; rate-limit middleware (C5) |
| C12 | Dependency pinning + lockfiles; npm audit; branch protection; signed deploys | `pnpm-lock.yaml`; `.github/workflows/audit.yml` (Dependabot); branch protection rules on `main` |
| C13 | Registrar lock; DNSSEC; auto-renewed TLS; HSTS preload | Hosting/infra config (Vercel or Cloudflare) — documented in `docs/infrastructure.md`; HSTS in `src/app/security-headers.ts` |
| C14 | Staff security briefing; unique named accounts | Operational — documented in `docs/staff-onboarding.md`; enforced by Payload auth (no shared accounts) |
| C15 | Encrypted automated backups; offline/immutable copy; restore tested | Hosting backup config + `docs/backup-procedure.md`; restore drill documented |
| C16 | CAPTCHA/turnstile on booking if abuse detected; max seats per booking | `src/lib/bookings/anti-abuse.ts` — Turnstile integration; max seats enforced in seat-hold transaction (ADR-002) |
| C17 | Google Translate on user action; SRI where possible; no PII pages translated | ADR-006 implementation: `src/components/TranslateSwitcher.tsx`; `notranslate` class on PII routes |
| C18 | Check-in tool: no local storage; session-based auth; remote revoke | `src/app/(check-in)/**` — session-only auth; no localStorage; session revoke in admin |
| C19 | Infrastructure patching SLA; minimal exposed services; SSH key-only | Hosting/infra — documented in `docs/infrastructure.md` |
| C20 | Export actions logged and role-restricted; watermark/justification for bulk export | `src/payload/collections/AuditLog.ts` — export event type; Payload access control restricts export to Admin role |

### DPIA Sec 6: Privacy-by-design measures to targets

| # | Measure | Implementation target |
|---|---|---|
| 1 | TLS 1.2+ everywhere; HSTS; encryption at rest for DB and backups | `src/app/security-headers.ts` (HSTS); hosting config (TLS, DB encryption) |
| 2 | Stripe hosted payment elements; zero card data on MFA systems (PCI SAQ-A) | ADR-004: Stripe Checkout redirect; no `src/lib/stripe/` that handles card data |
| 3 | Opaque, single-use, random QR tokens; authenticated check-in | ADR-003: `src/lib/qr/token.ts`; `src/app/api/check-in/route.ts` |
| 4 | Admin MFA + RBAC (Admin vs Door-staff) + audit logging | `src/payload/auth.config.ts`; `src/payload/access/*.ts`; `src/payload/collections/AuditLog.ts` |
| 5 | Data-minimised booking form; optional structured dietary field with explicit consent | `src/components/booking/BookingForm.tsx` — only lead attendee fields; dietary field optional + consent checkbox + NFR-7 compliance |
| 6 | Retention automation and anonymisation jobs | `src/lib/cron/retention.ts` — deletes/anonymises per DPIA Sec 2.3 schedule |
| 7 | Art 28 DPAs with all processors; Art 30 records updated | Legal/contractual — documented in `docs/dpa-register.md` |
| 8 | Privacy notice (EN/MT), cookie banner, user-activated translation | `src/app/(public)/privacy/page.tsx`; `src/components/CookieBanner.tsx`; ADR-006 translate switcher |
| 9 | Breach response: 72h IDPC notification; Art 33/34 paths | `docs/incident-response-plan.md` — references contact card (DPO, CSIRTMalta, Agilex+, host) |
| 10 | Backend supports search-and-erase/anonymise per data subject | `src/app/api/admin/data-subject/route.ts` — lookup by email/reference; anonymise action |

### EU Legal Memo: 12 consolidated actions to targets

| # | Action | Implementation target |
|---|---|---|
| 1 | Art 28 DPAs: Stripe, hosting, email provider | Legal: `docs/dpa-register.md` |
| 2 | MFA NIS2 designation confirmed | Operational: MFA to confirm; recorded in `docs/nis2-status.md` |
| 3 | Legal set drafted: Privacy Notice (EN+MT), Cookie Policy, Cancellation Policy, Customer Policy/ToR, Accessibility Statement, Provider Info page | `src/app/(public)/privacy/page.tsx`, `/cookies/page.tsx`, `/cancellation-policy/page.tsx`, `/customer-policy/page.tsx`, `/accessibility/page.tsx`, `/provider-info/page.tsx` |
| 4 | VAT treatment confirmed; prices displayed as totals | Backend stores prices in cents; frontend formats with "incl. VAT" label: `src/lib/format/price.ts` |
| 5 | 'Pay now' wording on final button; policy checkboxes; email = durable medium | `src/components/booking/PaymentStep.tsx` (button text); `src/components/booking/PolicyCheckboxes.tsx`; email confirmation = durable medium per ADR-004 |
| 6 | Real-capacity scarcity indicators; review-verification statement | `src/components/events/AvailabilityBadge.tsx` — renders live count from DB; `src/components/testimonials/VerificationStatement.tsx` |
| 7 | WCAG 2.1 AA + automated audit + accessibility statement | `tests/accessibility/` (axe-core); `src/app/(public)/accessibility/page.tsx`; manual audit before go-live |
| 8 | Cookie banner gating non-essential scripts; Google Translate user-activated | `src/components/CookieBanner.tsx`; ADR-006 translate consent gate |
| 9 | All DPIA Sec 6 and Cyber Sec 3 controls | This ADR — comprehensive mapping above |
| 10 | DPO sign-off of DPIA; privacy notice published; breach runbook | Operational: MFA DPO; `docs/incident-response-plan.md` |
| 11 | Staff onboarding: named accounts, MFA, phishing briefing | Operational: `docs/staff-onboarding.md` |
| 12 | Annual review of compliance documents | Operational: reminder in project handover document |

### MITA Website Policy (GMICT P 0051)
Per the quote, the website shall be developed in compliance with MITA Website Policy GMICT P 0051. Key conformance areas:

| GMICT P 0051 area | Implementation target |
|---|---|
| Accessibility (WCAG 2.1 AA) | Covered by EU Action 7 above; `src/app/(public)/accessibility/page.tsx` |
| Privacy and data protection | Covered by DPIA measures; `src/app/(public)/privacy/page.tsx` |
| Security (HTTPS, secure coding) | Covered by C1–C20 above |
| Branding and visual identity | NFR-1: brand palette + Montserrat; `src/styles/theme.ts` |
| Content management and governance | Payload CMS collections + publishing workflows |
| Cookie compliance | `src/components/CookieBanner.tsx` |
| Provider information | `src/app/(public)/provider-info/page.tsx` |
| Multilingual requirements | ADR-006: EN/MT switcher |
| Domain and hosting standards | `docs/infrastructure.md` |

## Consequences

### Positive
- Every compliance requirement has a concrete file or module target — auditable by grep, code review, or file existence check.
- The pre-go-live security checklist (Sec 3 of cyber assessment) is embedded in the CI pipeline: `tests/security/checklist.spec.ts` — a Playwright test that verifies each checklist item.
- Compliance is a build gate: CI fails if compliance targets are missing or tests fail.

### Negative
- This ADR is large and must be maintained alongside code changes — if a target path changes, this ADR must be updated. Mitigation: the compliance mapping is referenced in each target file as a comment (at-compliance: C7, DPIA-6.2), and a CI script (`scripts/verify-compliance.sh`) checks that every control listed here has a corresponding file or comment in the codebase.
- Some controls (C13, C14, C15, C19) are operational/infrastructure concerns — their "target" is a documentation page, not code. This is acceptable: the ADR records where the evidence lives.

### Neutral
- The compliance mapping is a living document. As implementation progresses, specific file paths may change — the ADR should be updated via patch commits with the same rigour as code.

## Compliance Mapping (self-referential)
| Requirement | How this ADR addresses it |
|---|---|
| URD Sec 7 (compliance annexes binding) | All Annex A (DPIA), B (Cyber), C (EU Legal) measures mapped to implementation targets. |
| C1–C20 (all 17 controls, numbered 1 through 20) | Every control has a concrete file/module path in the implementation targets table. |
| DPIA Sec 6 (10 privacy-by-design measures) | Every measure has a concrete implementation target. |
| EU Legal 12 consolidated actions | Every action has a file path or operational document target. |
| MITA Website Policy (GMICT P 0051) | Conformance areas mapped to implementation targets. |
| Pre-go-live security checklist (9 items) | CI-gated via `tests/security/checklist.spec.ts`. |
