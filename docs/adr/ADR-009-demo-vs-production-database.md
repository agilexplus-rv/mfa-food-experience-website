# ADR-009: Demo Environment Database (hosted libSQL) vs Production (PostgreSQL)

## Status
Accepted

## Context
ADR-001 establishes PostgreSQL as the production database for the Malta Food Experience
booking platform. Before production sign-off, MFA stakeholders need a live, clickable
demo environment to give feedback on flows (booking, admin, coupons) without provisioning
production infrastructure first.

The codebase's `payload.config.ts` already supports two adapters, selected purely by the
scheme of `DATABASE_URL`:

```ts
const dbAdapter = process.env.DATABASE_URL?.startsWith('postgres')
  ? postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL } })
  : sqliteAdapter({
      client: {
        url: process.env.DATABASE_URL || 'file:./payload.db',
        authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
      },
    })
```

The default (no `DATABASE_URL` set) is a local SQLite file — fine for local dev, but
**unsafe for a hosted demo**: Vercel's serverless filesystem is ephemeral/read-only at
runtime, so a `file:./payload.db` deploy loses all data (bookings, admin edits, seeded
content) on every cold start or redeploy.

## Options Considered

### Option A: Stand up production Postgres before any demo
- **Pros**: no divergence between demo and production stack.
- **Cons**: blocks stakeholder feedback behind DB provisioning/ops decisions that haven't
  been made yet; premature commitment to a specific Postgres host before the platform
  is approved.

### Option B: Hosted libSQL (Turso) for the demo, Postgres for production
`@payloadcms/db-sqlite` is built on `@libsql/client`, which speaks the libSQL wire
protocol — the same client can point at a local file **or** a persistent, hosted
libSQL database over HTTPS (`libsql://<db>.turso.io`) with an auth token. No adapter
code changes are required; only `DATABASE_URL` (and `DATABASE_AUTH_TOKEN`) differ
between environments.

- **Pros**: zero code fork between demo and prod — the exact same `payload.config.ts`
  ships to both; demo data persists across deploys/cold starts so stakeholder feedback
  and seeded content survive; Turso free tier is sufficient for a low-traffic feedback
  demo; no premature commitment to a production Postgres host.
- **Cons**: demo runs on a different underlying engine (SQLite/libSQL vs Postgres) —
  functional parity is high (Payload abstracts most differences) but not
  100% identical (e.g. some advanced Postgres-only query features, concurrent-write
  semantics under high load). Acceptable for a feedback demo, not for go-live.

## Decision
**Option B.** Demo environment uses hosted libSQL (Turso); production uses PostgreSQL
per ADR-001, unchanged. Switching environments is a Vercel environment-variable change
only — `DATABASE_URL` set to a `postgresql://...` connection string automatically
routes to `postgresAdapter` at build/boot time, with no code deploy required.

| Environment | `DATABASE_URL` | `DATABASE_AUTH_TOKEN` | Adapter used |
|---|---|---|---|
| Local dev | `file:./payload.db` (default) | not set | `sqliteAdapter` (local file) |
| Demo / feedback (Vercel preview or production alias) | `libsql://<db>-<org>.turso.io` | Turso auth token | `sqliteAdapter` (hosted libSQL) |
| Production (go-live) | `postgresql://user:pass@host:5432/mfa_food` | not set | `postgresAdapter` |

## Consequences

### Positive
- Stakeholders can review and give feedback on a persistent, hosted demo today, without
  waiting on production Postgres provisioning or hosting decisions.
- No code branching or feature flags between demo and production — the same commit
  ships to both; only env vars change.
- Cutover to production is a configuration change (`DATABASE_URL` + secret rotation),
  not a code change or redeploy of adapter logic.

### Negative
- Demo data lives in Turso, a separate vendor from the eventual production host — must
  not be treated as a system of record; before go-live, seeded/demo bookings must be
  discarded (not migrated) and production Postgres seeded fresh per FR/DPIA data-handling
  requirements.
- Minor behavioural differences between SQLite/libSQL and Postgres (e.g. transaction
  isolation, some type coercions) are possible; acceptable for UI/flow feedback but the
  final acceptance test pass must run against the production Postgres adapter before
  go-live sign-off.

## Compliance Mapping
| Requirement | How this ADR addresses it |
|---|---|
| DPIA Sec 2.4 (EU-region hosting) | Turso demo is feedback-only, non-production, and must not hold real personal data — seed with synthetic bookings/testimonials only. |
| C15 (encrypted backups) | Not applicable to the demo tier; production Postgres backup posture is unchanged from ADR-001. |
| ADR-001 alignment | Production database choice (PostgreSQL) is unchanged; this ADR only adds a pre-production demo tier. |
