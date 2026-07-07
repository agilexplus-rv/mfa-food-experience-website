# Malta Food Experience -- Compliance Gap Audit

**Date:** 7 July 2026
**Scope:** Verification of ADR-008 ("Compliance Gate") claims against the actual, running codebase and live demo database -- not a re-statement of the ADR's own implementation-target table.
**Method:** Direct inspection of source files, live database queries, and configuration for every item in Annex B (Cybersecurity, C1-C20), Annex A (DPIA, 10 measures), Annex C (EU/Malta Legal Memo, 12 actions), and the MITA GMICT P 0051 conformance table.
**Reference:** docs/adr/ADR-008-compliance-gate.md

---

## Executive Summary

The platform's core booking/payment/check-in engineering (Phases 2-3 of the implementation plan) is built, tested, and live. Compliance work (Phase 4) has not materially started. Of the 20 cybersecurity controls, 10 DPIA measures, and 12 legal actions this ADR commits to, roughly one third are genuinely implemented and verified; the majority are either partially done, stubbed with an explicit warning, or not started at all -- several with no code or document artifact whatsoever.

Two findings carry particular weight because they are both explicitly named as mandatory in the ADR and are currently live in production:

1. Admin login has no MFA. This is not a partial implementation -- it is a stub that logs a warning on every admin login ([C4/MFA-STUB] Admin logged in without MFA) and does nothing else.
2. No privacy notice, cookie banner, or accessibility statement exists anywhere on the live site, despite the site running Google Translate (a non-essential third-party script) and collecting personal data (name, email, phone, dietary information) through a public booking form right now.

Neither of these should be read as a criticism of engineering quality -- the code that does exist (Stripe webhook verification, QR token generation, seat-hold concurrency) is genuinely correct and well-built. The gap is one of sequencing: compliance was planned as its own phase (Phase 4) and that phase has not yet been executed, while the product phases around it have.

---

## Cybersecurity Controls (C1-C20)

| # | Control | Status | Evidence |
|---|---|---|---|
| C1 | Parameterised queries; server-side input validation | Partial | Payload/Drizzle ORM parameterises all queries by construction. Zod validation exists only for the booking flow (src/lib/validations/booking.ts); coupon validation, check-in, and other routes validate inline or not at all. |
| C2 | Output encoding, CSP; sanitise rich text | Partial | HSTS, X-Content-Type-Options, and Referrer-Policy headers ARE set in next.config.ts. No Content-Security-Policy header exists at all -- the ADR specifically requires one covering Stripe and Google Translate domains, and it is simply absent. |
| C3 | Testimonials/news rendered as text; no raw HTML from user input | Not implemented | No sanitizeHtml.ts or Payload afterRead hook exists anywhere in the codebase. |
| C4 | MFA (TOTP) mandatory on admin accounts | Stubbed | Confirmed in code and in docs/security/auth.md: mfaEnabled/totpSecret fields exist on the Users collection but there is no TOTP setup flow, no verification step, and no enforcement -- only a console warning on every admin login. This is the most consequential open item in this audit. |
| C5 | Login rate limiting, lockout; admin panel not linked publicly | Implemented | Confirmed live: 5 failed attempts locks the account for 15 minutes (triggered during earlier testing). Admin login is not linked from any public nav. |
| C6 | RBAC (Admin vs Door Staff); least privilege; audit log | Partial | RBAC is well-built -- a clear two-role matrix with field-level enforcement. Audit logging is narrow: only check-in and booking-cancellation events are actually written to audit_logs; general CRUD (booking creation, coupon edits, testimonial moderation, user management) is not logged, despite the collection schema supporting all of these event types. |
| C7 | Stripe webhook signature verification; idempotency; amount re-check | Implemented | Verified by direct code read: stripe.webhooks.constructEvent() against STRIPE_WEBHOOK_SECRET, idempotent handling via a booking.status === 'pending' guard, capacity re-verification in the finalisation path. Genuinely correct. |
| C8 | DB-level transactional seat allocation; server-side hold expiry | Partial, disclosed | Seat holds and availability checks are implemented and race-tested. A known, explicitly disclosed compromise: Payload's Local API doesn't expose true cross-call SQL transactions, so atomicity is approximated via careful operation ordering rather than a real BEGIN/COMMIT -- documented in code comments. |
| C9 | QR token: 128-bit or greater random, single-use, authenticated, rate-limited | Implemented | Verified by direct code read: crypto.randomBytes(16) then base32 then SHA-256 hash stored, raw token never persisted. Check-in endpoint has its own rate limiter (30 req/min) and requires a valid session. |
| C10 | High-entropy coupon codes; server-side limits; usage audit | Partial | Collections and server-side validation exist. Coupon use is recorded, but code-generation entropy is whatever an admin manually types -- no enforced minimum entropy or auto-generation. |
| C11 | CDN/WAF; rate limits on booking and coupon endpoints | Not implemented | Rate limiting exists only on /api/check-in. /api/holds, /api/checkout, /api/coupons/validate have no rate limiting at all. No WAF/CDN rules configured. |
| C12 | Dependency pinning; npm audit; branch protection; signed deploys | Not implemented | package-lock.json exists, but there is no .github directory at all -- no CI workflow, no Dependabot config, no branch protection rules on main. |
| C13 | Registrar lock; DNSSEC; auto-renewed TLS; HSTS preload | Not code-verifiable | Infrastructure/DNS-registrar concern. No docs/infrastructure.md exists to record the current state either way. |
| C14 | Staff security briefing; unique named accounts | Partial | Named accounts are enforced technically. No docs/staff-onboarding.md or briefing record exists. |
| C15 | Encrypted automated backups; offline/immutable copy; tested restore | Not code-verifiable | No docs/backup-procedure.md exists and no restore drill has been documented. |
| C16 | CAPTCHA/Turnstile on booking if abuse detected; max seats per booking | Partial | Max-seats-per-booking is enforced. No Turnstile/CAPTCHA integration exists anywhere -- no anti-abuse.ts file, no bot-mitigation on the public booking form. |
| C17 | Google Translate on user action; SRI where possible; no PII pages translated | Partial | The switcher genuinely requires a user click. No notranslate class found applied to PII-bearing pages (booking form, confirmation page) -- needs to be added and verified. |
| C18 | Check-in tool: no localStorage; session-based auth; remote revoke | Implemented | Cookie-based session, no client-side token storage observed, admin can revoke access by disabling a user account. |
| C19 | Infrastructure patching SLA; minimal exposed services; SSH key-only | Not code-verifiable | Vercel-hosted, serverless -- no persistent server to patch in the traditional sense, but not documented as a deliberate position. |
| C20 | Export actions logged; role-restricted; watermark/justification for bulk export | Not implemented | No export functionality exists yet in the admin surface, and consequently no logging for it either. |

Cyber controls tally: 5 fully implemented, 8 partial, 5 not implemented, 2 not code-verifiable (infrastructure/operational)

---

## DPIA -- Privacy-by-Design Measures (Annex A, Sec. 6)

| # | Measure | Status | Evidence |
|---|---|---|---|
| 1 | TLS everywhere; HSTS; encryption at rest | Partial | HSTS confirmed. TLS inherent to Vercel hosting. Encryption-at-rest is a hosting-provider property but not documented as confirmed/enabled anywhere. |
| 2 | Stripe hosted Checkout; zero card data on MFA systems | Implemented | Stripe Checkout is a hosted redirect; no card-handling code exists anywhere in the app. |
| 3 | Opaque, single-use, random QR tokens; authenticated check-in | Implemented | Same evidence as C9 above. |
| 4 | Admin MFA plus RBAC plus audit logging | Partial (RBAC yes, MFA no, audit narrow) | Same underlying evidence as C4/C6 above. |
| 5 | Data-minimised booking form; optional dietary field with explicit consent | Implemented | Confirmed in BookingForm.tsx -- dietary notes optional with a distinct consent checkbox. |
| 6 | Retention automation and anonymisation jobs | Not implemented | No src/lib/cron/retention.ts or equivalent exists. |
| 7 | Art. 28 DPAs with all processors; Art. 30 records | Not implemented | No docs/dpa-register.md exists. Legal/contractual task, currently untouched. |
| 8 | Privacy notice (EN/MT); cookie banner; user-activated translation | Not implemented | No privacy notice page exists at all. No cookie banner component exists. Google Translate is at least user-activated (partial credit). |
| 9 | Breach response plan (72h IDPC notification path) | Not implemented | No docs/incident-response-plan.md exists. |
| 10 | Search-and-erase / anonymise backend support | Not implemented | No /api/admin/data-subject route or equivalent exists. |

DPIA tally: 2 fully implemented, 2 partial, 6 not implemented

---

## EU and Malta Legal Compliance Memo -- 12 Consolidated Actions

| # | Action | Status | Evidence |
|---|---|---|---|
| 1 | Art. 28 DPAs: Stripe, hosting, email provider | Not implemented | Same gap as DPIA #7. |
| 2 | MFA (the client organisation) NIS2 designation confirmed | Not implemented | No docs/nis2-status.md; legal/regulatory determination outside engineering scope, currently unresolved. |
| 3 | Legal page set: Privacy Notice, Cookie Policy, Cancellation Policy, Customer Policy, Accessibility Statement, Provider Info | Partial | The legal/[slug] page infrastructure exists and correctly renders Payload-managed content for cancellation-policy, customer-policy, and provider-info slugs. Direct live-DB query confirms the policies collection currently has zero rows -- every one of these pages, including the three with working code, shows a "being prepared" placeholder. Privacy Notice, Cookie Policy, and Accessibility Statement have no page at all, not even a placeholder route. |
| 4 | VAT treatment confirmed; prices shown as totals | Not implemented | No "incl. VAT" or equivalent labelling found anywhere in the pricing display code. |
| 5 | "Pay now" wording; policy checkboxes; email as durable medium | Implemented | Checkout button reads exactly "Pay now", cancellation-policy acknowledgement checkbox present, confirmation email sent on successful payment. |
| 6 | Real-capacity scarcity indicators; review-verification statement | Partial | Scarcity indicators implemented and correct ("X seats left"). No verification statement exists for testimonials. |
| 7 | WCAG 2.1 AA plus automated audit plus accessibility statement | Not implemented | No tests/accessibility/ directory, no axe-core integration, no accessibility statement page. One real WCAG AA failure was found and fixed on the admin login this session, but that was a narrow spot-check, not a site-wide audit. |
| 8 | Cookie banner gating non-essential scripts; user-activated translation | Partial | No cookie banner exists. Google Translate is at least user-activated. |
| 9 | All DPIA Sec 6 plus Cyber Sec 3 controls | -- | Rolls up the tables above; see tallies. |
| 10 | DPO sign-off; privacy notice published; breach runbook | Not implemented | All three sub-items depend on artifacts that don't yet exist. |
| 11 | Staff onboarding: named accounts, MFA, phishing briefing | Partial | Named accounts: yes (technical). MFA: no. Phishing briefing: no record. |
| 12 | Annual review reminder in handover doc | Not implemented | No handover document exists yet. |

EU Legal tally: 2 fully implemented, 3 partial, 6 not implemented (1 rollup item)

---

## MITA Website Policy (GMICT P 0051)

| Area | Status | Notes |
|---|---|---|
| Accessibility (WCAG 2.1 AA) | Not implemented | Same gap as EU Legal #7. |
| Privacy and data protection | Not implemented | Same gap as EU Legal #3/DPIA #8. |
| Security (HTTPS, secure coding) | Partial | HTTPS via Vercel; secure-coding practices generally solid but MFA and CSP gaps above apply here too. |
| Branding and visual identity | Implemented | Confirmed strong and consistent -- brand palette/typography correctly applied across public site and the admin surface. |
| Content management and governance | Implemented | Payload CMS collections and publishing workflow are genuinely well-structured. |
| Cookie compliance | Not implemented | No cookie banner. |
| Provider information | Partial | Page infrastructure exists but has no content yet (zero rows in policies). |
| Multilingual requirements | Implemented | EN/MT via Google Translate switcher, user-activated. |
| Domain and hosting standards | Not code-verifiable | No docs/infrastructure.md to confirm registrar/DNS/TLS posture. |

---

## Overall Tally

| Category | Implemented | Partial | Not implemented | Not code-verifiable |
|---|---|---|---|---|
| Cyber (C1-C20) | 5 | 8 | 5 | 2 |
| DPIA (10 measures) | 2 | 2 | 6 | 0 |
| EU Legal (12 actions) | 2 | 3 | 6 | 0 (1 rollup) |
| MITA (9 areas) | 3 | 2 | 3 | 1 |

Across all four frameworks: roughly 25% fully implemented, 35% partial, 33% not started, 7% operational/not code-verifiable.

---

## Recommended Priority Order

This is not the full remediation plan (that should be scoped as its own piece of work), but a rough sense of what matters most given what's live right now:

1. MFA enforcement (C4) -- the single highest-severity gap. The site is live and taking admin logins with zero second factor, and the code already contains the stub warning acknowledging this.
2. Privacy Notice, Cookie Banner, and Accessibility Statement -- the site is live, running Google Translate (a third-party script) and collecting personal data, with none of the three legally-required disclosure surfaces in place.
3. Populate the policies collection -- the fastest win in this whole list: the code for cancellation/customer/provider-info pages already works, it just has zero content behind it.
4. Content-Security-Policy header (C2) -- a single, bounded piece of engineering work, meaningfully raises the security baseline.
5. Rate limiting on booking/checkout/coupon endpoints (C11) and basic bot mitigation (C16) -- currently the most exposed public-facing endpoints.
6. Retention/anonymisation automation and a data-subject erasure endpoint (DPIA #6, #10) -- required before the platform can be said to genuinely support data-subject rights.
7. Everything else (audit-log breadth, dependency-scanning CI, Turnstile, testimonial verification statement, VAT labelling) -- real but lower-severity, suitable for a follow-up sprint once the above are closed.

Operational/legal-only items (DPA register, NIS2 designation, staff briefing, backup-restore drill, infrastructure documentation) sit outside pure engineering scope and should be tracked separately with the client's own legal/ops function, though Agilex+ can draft the documents.
