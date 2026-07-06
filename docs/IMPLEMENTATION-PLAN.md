# Malta Food Experience — Booking Platform Implementation Plan

Execute via kanban swarm — Fable (T1) architecture run first, then tier-assigned build tracks. Verify every worker's "done" independently.

Goal: production-grade bilingual (EN/MT) booking platform (race-safe seats, payments, QR check-in, admin dashboard), compliant with Brand Guidelines + compliance annexes. Change order beyond Quote QT-07042026-MFA.

Architecture (ratified by Fable ADR run): Next.js 14+ App Router (TS) | Payload CMS | PostgreSQL | Prisma | NextAuth+RBAC | Stripe hosted | qrcode+HMAC | next-intl+Google Translate | Resend | Vercel/GH Actions. Existing repo = throwaway prototype; keep brand assets only.

Model pinned per task via --assignee (mechanical). Board: mfa-booking-platform. Workspace: dir:/workspace/projects/mfa/mfa-food-experience-website.

Phase 0 (T1 Fable, sequential): 0.1 ADRs 001-008 (solution-architect); 0.2 scaffold (fullstack); 0.3 data model+migrations (fullstack); 0.4 brand system Montserrat+palette+logos (ux); 0.5 auth+RBAC (security). Gate: ADRs reviewed vs URD before build.

Phase 1 frontend (glm->t2): site chrome, home, service pages, about/contact, news, testimonials(t2), policies(t2), GT switcher(t2).

Phase 2 booking engine (t2 Opus): flow UI, cart+timer race-safe, seat availability, coupons atomic, Stripe, email+QR, check-in, policy checkbox.

Phase 3 admin (glm->t2): Payload config, CRUD+toggles, bookings mgmt(t2), coupon admin, testimonial moderation, news/policy editors.

Phase 4 compliance (t1 Fable): cyber C1-C20, DPIA measures, GDPR PII, WCAG AA, consumer-law surface.

Phase 5 QA/deploy (t2+glm): Playwright E2E, cross-browser, SEO, deploy+CI, handover.

Verification: every worker claim re-checked — concurrent seat test, brand grep+visual, opsec grep before push, controls mapped to code, SHA vs origin.
Open questions (URD sec 6): payment provider, hold duration, refunds, dietary field, max persons, news pages, email domain, PII retention, NIS2, DPO, testimonial verification, VAT.
Risks: MITA GMICT P 0051; GT legal imprecision; payment TBD; scope=change order.
