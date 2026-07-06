# ADR-001: Content Management System

## Status
Accepted

## Context
The original proposal (Quote QT-07042026-MFA, EUR 4,800) specified Sanity as the headless CMS — a managed cloud service with a visual editor, native Next.js integration, and a free Starter tier (2 non-admin users, 10K API req/day, 5 GB bandwidth). At scale, Sanity's Growth plan starts at EUR 99/month.

This change order upgrades the project from a marketing shell with an email-only booking form into a full transactional booking platform (URD v1.1). The platform requires:

- **Content management**: services, events, news, testimonials, policy pages, rich text, images, publish toggles (FR-1, FR-6, FR-7, FR-8, FR-9).
- **Transactional data**: bookings, coupons, payments, QR tokens, check-in records — a relational database with ACID guarantees (FR-2, FR-3, FR-4, FR-5).
- **Admin backend**: CRUD operations across all entities, role-based access control (Admin vs Door-staff), search/filter/export of bookings (FR-6).
- **Zero recurring fees** is a strong incentive for a public authority with constrained budgets.

Sanity can model content types, but it is not a transactional booking database. Using it alongside a separate Postgres database introduces a two-backend architecture with synchronisation complexity, two authentication surfaces, and two vendor relationships.

## Options Considered

### Option A: Sanity (quote default) + separate Postgres booking DB
Sanity manages content (services, events, news, policies, testimonials). A separate PostgreSQL database manages bookings, coupons, payments, and QR tokens.

- **Pros**: visual editor UX for non-technical staff; matches original quote; minimal admin UI to build for content operations.
- **Cons**: two CMS/DB surfaces to maintain, secure, and back up; content entities (events, services) split across two systems; no single source of truth for event capacity/visibility; EUR 99/month at scale; vendor lock-in; complex deploy and data-residency posture.

### Option B: Payload CMS (self-hosted, in-repo, Postgres-backed)
Payload CMS runs inside the Next.js application, backed by PostgreSQL. All data — content + transactions — lives in one database with one access-control system.

- **Pros**: single database (Postgres) for content, bookings, coupons, users, and audit logs; zero recurring CMS fees; full data ownership and EU residency under MFA's hosting control; one authentication surface (Payload's built-in auth + RBAC); no vendor lock-in (content and data are MFA's Postgres instance); in-repo configuration as TypeScript — version-controlled, reviewable, deployable; admin UI auto-generated from collection schemas.
- **Cons**: requires PostgreSQL hosting (~EUR 5–15/month on a VPS or managed Postgres); admin UI is functional rather than the polished Sanity Studio visual editor; MFA staff need brief familiarisation with a forms-based admin panel rather than a block-based visual editor.

## Decision
**Option B: Payload CMS (self-hosted, in-repo, PostgreSQL-backed).**

Rationale:
1. **Single source of truth**: one PostgreSQL database holds all structured data — content, events, bookings, coupons, users, audit logs — eliminating synchronisation gaps and dual-auth complexity (C6, C20, DPIA Sec 6.4).
2. **Zero CMS recurring cost**: no EUR 99/month liability at scale; only PostgreSQL hosting costs, which MFA controls directly.
3. **Compliance posture**: all data under MFA's EU-region hosting (DPIA Sec 2.4 requirements); no third-country CMS processor to assess; Art 28 DPA needed only for the host, not the CMS vendor.
4. **TypeScript-native**: entire data model defined in-repo as Payload collections — version-controlled alongside the application, reviewable in PRs, trivially reproducible in staging.
5. **Built-in auth + RBAC**: Payload provides authentication, access control, and collection-level permissions out of the box, mapping directly to the Admin / Door-staff role model (C4, C6, DPIA Sec 6.4).
6. **MIT-licensed, mature**: active community, stable release track, and no licensing cost.

## Consequences

### Positive
- Single Postgres instance is the platform's only stateful dependency — simplifies backup (C15), restore testing, and disaster recovery.
- Admin UI auto-generated for all collections — reduces frontend build effort for the admin area (estimated 30–40% less custom admin UI code).
- No recurring CMS fees; total infrastructure cost reduced to hosting + managed Postgres (~EUR 15–30/month).
- Full data portability: `pg_dump` exports everything — content and transactions.

### Negative
- Admin UI is forms-based rather than block-based visual editing; MFA staff may perceive it as less polished than Sanity Studio (mitigation: customise Payload's admin UI with brand colours and component overrides per NFR-1).
- Self-hosted operational responsibility: PostgreSQL backups, patching, and monitoring are MFA/hosting responsibilities, not abstracted by a SaaS vendor.
- Learning curve: the development team must learn Payload's collection and access-control patterns (mitigated by extensive documentation and the in-repo, TypeScript-first approach).

### Neutral
- Sanity's free tier would have sufficed for content-only; the upgrade to a full booking platform makes the two-backend architecture untenable.

## Compliance Mapping
| Requirement | How this ADR addresses it |
|---|---|
| FR-1.2 (service toggles) | Payload boolean field on service collection, admin-editable — no code change to toggle. |
| FR-6 (admin backend) | Payload's auto-generated admin UI provides CRUD for all collections; RBAC enforced at collection level. |
| FR-8 (testimonial moderation) | Payload collection with `_status: draft/published` — gating enforced by access control. |
| NFR-5 (non-technical staff) | Forms-based admin UI; all routine operations (content, events, coupons, bookings) achievable without developer support. |
| C6 (RBAC, least privilege) | Payload access control functions enforce Admin vs Door-staff roles per collection. |
| C15 (encrypted backups) | Single Postgres database simplifies `pg_dump` + encrypted backup automation. |
| C20 (export logging) | Audit log collection tracks admin actions, including exports. |
| DPIA Sec 6.4 (admin MFA + RBAC) | Payload auth supports MFA; RBAC defined in collection access-control functions. |
| DPIA Sec 6.7 (Art 28 DPAs) | Reduces processor count: CMS vendor eliminated from processor list. |
| EU Legal Sec D.4 (pricing displayed EUR, VAT-inclusive) | Backend stores prices as integers (cents); frontend formats per locale. |
