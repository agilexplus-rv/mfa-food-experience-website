# ADR-007: Repository Structure

## Status
Accepted

## Context
The Malta Food Experience platform comprises three runtime surfaces:
1. **Public frontend**: marketing pages + booking flow (Next.js App Router)
2. **Admin backend**: Payload CMS admin UI + API (runs inside Next.js, per ADR-001)
3. **Check-in tool**: mobile-friendly staff portal for QR scanning (same Next.js app, Door-staff role-gated routes)

With Payload CMS running in-repo (ADR-001), the admin surface is a set of routes and collections within the Next.js application — not a separate service. The question is whether anything else warrants a separate repository or service.

Constraints:
- Payload CMS is installed as an npm dependency inside the Next.js project — by design, it is co-located (ADR-001).
- PostgreSQL is the single database for content, bookings, users, and audit logs (ADR-001).
- The check-in tool is a set of authenticated, Door-staff-gated pages within the same Next.js app — not a separate mobile app.
- Deployment target is a single Node.js server or serverless platform (Vercel), not a microservice cluster.
- All three surfaces share authentication (Payload auth), the same database, and the same TypeScript types.

## Options Considered

### Option A: Single repository — Next.js monolith with Payload in-repo
One Git repository. One Next.js application. One `package.json`. Payload is an npm dependency. The public frontend, admin UI, and check-in tool are route groups within the same App Router.

```
mfa-food-experience-website/
├── src/
│   ├── app/
│   │   ├── (public)/        # Marketing + booking flow
│   │   ├── (admin)/         # Payload admin UI (auto-generated routes)
│   │   └── (check-in)/      # Door-staff QR check-in
│   ├── payload/             # Payload config, collections, hooks
│   ├── components/          # Shared UI components
│   ├── lib/                 # Shared utilities, DB client, Stripe helpers
│   └── emails/              # Transactional email templates
├── migrations/              # Drizzle/Prisma migrations
├── public/                  # Static assets, brand logos
├── docs/                    # ADRs, architecture docs
├── tests/                   # Playwright E2E, Vitest unit
├── package.json
└── payload.config.ts
```

- **Pros**: single source of truth for all TypeScript types — no sync gaps between frontend and admin; shared auth (Payload) across all three surfaces with zero integration code; one build, one deploy, one CI pipeline; no cross-repo dependency management; simplest developer experience — `pnpm dev` runs everything; Payload's auto-generated admin UI requires no cross-origin configuration.
- **Cons**: larger monolith — any change triggers a full rebuild (mitigated by Next.js's fast refresh and Payload's HMR); the frontend bundle includes admin code if not properly code-split (mitigated by Next.js route-based code splitting — admin routes are in a separate chunk, never loaded by public visitors).

### Option B: Separate admin service
The Payload admin backend runs as a separate Next.js instance or Express server on a different port or subdomain (e.g. `admin.foodagency.mt`), with the public frontend as a separate Next.js app consuming the Payload REST API.

- **Pros**: independent deploy of admin vs frontend; smaller frontend bundle (admin code not in the same app); admin and public frontend can scale independently.
- **Cons**: two repositories or a monorepo with two packages — more CI complexity; cross-origin configuration for Payload's REST/GraphQL API (CORS, cookie domains); shared TypeScript types must be published as a package or duplicated; two builds, two deploys, two health checks; Payload's admin UI is designed to run in the same Next.js app — separating it fights the framework; over-engineering for a single-venue, low-traffic site.

## Decision
**Option A: Single Next.js repository with Payload in-repo.**

Rationale:
1. **Payload's architecture favours co-location**: Payload CMS is designed to run inside a Next.js application. Separating it adds complexity without benefit at MFA's scale.
2. **Shared auth surface**: Payload provides authentication. Placing admin, check-in, and public routes in the same app means a single auth middleware protects all three surfaces — no cross-service token sharing.
3. **Type safety across boundaries**: TypeScript types defined in Payload collections are directly importable in frontend components — no API contract drift, no code generation step, no shared package to version.
4. **Operational simplicity**: one deploy, one health check, one set of environment variables, one monitoring dashboard. MFA is a public authority with limited technical staff — fewer moving parts means fewer failure modes.
5. **Route-based code splitting**: Next.js App Router automatically code-splits by route. The Payload admin bundle (~200KB gzipped) is never loaded by public visitors. The public-facing bundle is unaffected.

Route groups and middleware:

```typescript
// middleware.ts — single file gating all three surfaces
export default function middleware(req) {
  // Public routes: no auth required
  // Admin routes (/admin/*): require Admin role
  // Check-in routes (/check-in/*): require Door-staff or Admin role
}
```

## Consequences

### Positive
- One codebase to understand, test, and deploy.
- Zero cross-service integration code — Payload collections are directly importable.
- Single CI pipeline: lint → type-check → test → build → deploy.
- Lower cognitive load for developers and operators.
- Route-based code splitting keeps the public bundle lean.

### Negative
- Monolith risk: a bug in admin code could theoretically crash the public site. Mitigated by Next.js route isolation (admin routes are separate entry points) and Payload's stable release track.
- Full rebuild on any change — acceptable at this project's scale (Next.js incremental builds mitigate this for production deploys).
- Single point of failure for deployment — a bad deploy affects all three surfaces. Mitigated by preview deployments (Vercel) or blue-green deploys.

### Neutral
- If MFA's needs grow to the point where a separate admin service is warranted, extracting it is straightforward: copy the `src/payload/` directory to a new Next.js project, configure CORS, and update DNS. The single-repo decision is reversible.

## Compliance Mapping
| Requirement | How this ADR addresses it |
|---|---|
| FR-1.2 (service toggles, no-code changes) | Co-located Payload collections → toggle changes are database writes, not deploys. |
| FR-6 (admin backend) | Payload admin UI served from `/admin` route group; RBAC via middleware. |
| C6 (RBAC, least privilege) | Single middleware file enforces role-based access across all three surfaces. |
| C12 (dependency pinning, lockfile) | Single `pnpm-lock.yaml` covers all dependencies — one audit surface. |
| NFR-5 (non-technical staff) | Admin UI auto-generated from collections — no separate admin build to manage. |
| EU Legal Sec D.3 (accessibility statement) | Accessibility statement page is a route in the public group — same codebase, same WCAG audit. |
