# Open items — Malta Food Experience

Last updated: **2026-11-14**. Owner column is who can actually close it.
This file is the register; the operations panel (`dsh-contracts`) reports live
status against it but does not replace it.

| # | Item | Severity | Status |
|---|---|---|---|
| OI-1 | Cost-control (Hermes) exclusion for prod + test | critical | **DONE 2026-11-13** |
| OI-2 | Log Analytics workspace for container logs | high | OPEN |
| OI-3 | ACR retention policy | medium | OPEN |
| OI-4 | Deploy-time migration job lacks ACR credentials | medium | OPEN |
| OI-5 | Homepage colour-contrast (WCAG AA) | high | OPEN |
| OI-6 | Production image built with the test base URL | high | FIXED 2026-11-14 |

---

## OI-1 — Cost-control exclusion — DONE

**Closed 2026-11-13** by the Hermes operator (CRM plugin PR #894, merged and
deployed). Recorded here with the evidence so nobody re-opens it by accident and
so the reasoning survives staff changes.

What the fix does:

- Both resource groups and both tags (`project = mfa-food-experience`,
  `cost-control = exclude`) are stored in `cost_control_exclusions.json`, tracked
  in the CRM plugin's repo, so the exclusion survives deploys.
- Excluded groups are checked **before** any allowlist is consulted; a group or
  resource carrying either tag is skipped too.
- The single function that issues every Azure call refuses any **write** into
  these groups — stop, deallocate, scale, delete, including
  `flexibleServers/*/stop`. Reads and *starting* a server are still allowed,
  because neither can take anything down.
- Fail-safe: if the config file is missing or unreadable, every write is refused
  everywhere.
- The allowlist cannot re-arm it: these groups are dropped from the allowlist if
  anyone adds them.
- 63 tests pass; disabling the guard on purpose made two of them fail.

Verification reported by the operator: dry run against live Azure shows every
resource in both groups `REFUSED`, `POST .../stop` returning
`HTTP 403 CostControlExcluded`, zero writes reaching Azure, and no stop events
recorded since 2026-11-04.

Independently corroborated here: the Azure activity log for the `hermes-agent`
service principal (`1675b1ad-c2d3-4dac-af1c-e4b10539a2ac`) contains **no
operations since 2026-11-06**, consistent with the stops having ceased.

**Do not** add ReadOnly locks on top: the guard is the real fix, and a lock would
block legitimate password rotation, scaling and restore.

---

## OI-2 — Log Analytics — OPEN (owner: Agilex+)

No workspace is attached to `mfa-food-experience-prod-env`, so `az containerapp
logs show` only sees the live replica and history is lost on restart. This is
exactly why the seed failure on 2026-11-13 had to be diagnosed from a log paste
in chat, and it is durable fix #4 in
`docs/incident-2026-11-04-test-database-outage.md`.

**Done when:** a workspace with a daily ingestion cap is attached to the
environment and the panel's log-based checks read from it.

**Note:** the Contracts panel's log-dependent checks should stay `skip` until
this exists — they must not pretend to have logs.

---

## OI-3 — ACR retention policy — OPEN (owner: Agilex+)

`mfaFoodExpAcr` (Basic) has no retention policy, so every deploy leaves tagged
and untagged images behind indefinitely.

**Done when:** an untagged-image retention rule (e.g. purge untagged after 7 days,
keep the last N tagged) is applied and confirmed by a list of repositories.

---

## OI-4 — Deploy-time migration job — OPEN (owner: Agilex+)

`.github/workflows/deploy.yml` creates/updates the `mfa-migrate-prod` container
app job without registry credentials, so the job cannot pull its image
(`UNAUTHORIZED`) and the deploy fails at that step. Worked around by setting
`MIGRATE_JOB_ENABLED=false`, which makes the app run `payload migrate` at boot —
the path the incident post-mortem warns against.

**Done when:** the job create/update passes `--registry-server/--registry-username
/--registry-password` (an `ACR_PASSWORD` environment secret) and
`MIGRATE_JOB_ENABLED` is back to `true`, with one green prod deploy proving the
job ran and `SKIP_BOOT_MIGRATIONS` was set.

---

## OI-5 — Homepage colour contrast — OPEN (owner: Agilex+)

axe-core reports `color-contrast` failures (2 nodes) on the homepage. The CI job
that should have failed the build was masked by a flaky dev-server start, so this
shipped. A government site that publishes an accessibility statement claiming
WCAG 2.2 AA cannot carry a known AA failure.

**Done when:** the failing nodes use a contrast ratio ≥ 4.5:1 (or ≥ 3:1 for large
text), axe reports zero `color-contrast` violations on the homepage, and the
accessibility CI job is deterministic enough to be trusted (fix the dev-server
flake in the same change or before it).

---

## OI-6 — Production image carried the test base URL — FIXED 2026-11-14

Found while adding the sitemap: live production HTML advertised
`<link rel="canonical" href="https://foodexperience.agilexplus.dev">` with
`og:url`/`og:image` on the same host, and `/sitemap.xml` listed every URL under
the dev domain.

**Root cause.** `deploy.yml` tagged both environments' images identically
(`mfa-food-experience:${sha}` and `:latest`). A merge to `main` triggers a test
deploy, and a production deploy is a manual dispatch of the *same commit* — both
builds push the same tag, so whichever finishes last wins it. The container then
runs an image whose `NEXT_PUBLIC_SERVER_URL` was baked for the other
environment. `NEXT_PUBLIC_*` is inlined at build time, so no runtime change can
correct it.

**Fix (both layers).**
- Image tags are environment-scoped: `:<env>-<sha>` and `:latest-<env>`, so a
  test build can never overwrite a production image.
- `deploy.yml` sets a plain `SERVER_URL` beside `NEXT_PUBLIC_SERVER_URL`, and
  server-rendered absolute URLs (canonical, OpenGraph, sitemap, robots) prefer
  it. It is read per request, so metadata stays correct even if an image is
  mis-built again. `sitemap.ts` and `robots.ts` render per request.

**Done when:** a production deploy shows `foodexperience.mt` in canonical,
`og:url` and every sitemap entry, with no `agilexplus.dev` in production HTML.
