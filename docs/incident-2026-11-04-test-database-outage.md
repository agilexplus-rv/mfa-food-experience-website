# Incident: test environment down — 3–4 Nov 2026

**Impact.** `foodexperience.agilexplus.dev` was unavailable for several hours. No production
environment exists yet, so no customer-facing impact and no payments affected.

**Status.** Resolved. Root cause removed by a resource lock; durable fix outstanding (see below).

## Timeline (UTC)

| Time | Event |
|---|---|
| 03 Nov 21:47 | `hermes-agent` stops the test PostgreSQL server — first of nine stops in 7 days |
| 21:47 → 04 Nov 09:19 | Every attempt to recover is undone within 3–16 minutes |
| ~22:50 | Database password rotated. **Verified working** (0 failed connections, 22 active) |
| ~23:00 | Second rotation attempt interrupted, leaving database and `DATABASE_URL` secret disagreeing |
| 04 Nov 09:44 | Container log: `password authentication failed for user "mfaadmin"` (`28P01`) |
| ~09:50 | Database password aligned to the value already deployed in the Container App secret |
| 10:05 | Database started; `ReadOnly` resource lock applied within seconds of `Ready` |
| ~10:15 | Revision restarted; site back, all checks green |

## Root cause

**`hermes-agent`** (`1675b1ad-c2d3-4dac-af1c-e4b10539a2ac`, appId `a6a0cb98-62b4-46f5-9a2a-84c15a63902b`)
— the Agilex+ Hermes platform — runs a cost-control routine that stops the test PostgreSQL
server. It issued **nine stops in seven days**, each 3–16 minutes after a successful start. It also
owns the Container App (`lastModifiedBy`), so it manages the whole environment.

It never starts anything: 18 stop events, zero starts.

### Why that caused an outage rather than a pause

`infra/entrypoint.sh` runs `payload migrate` **before** starting Next.js, under
`set -euo pipefail`:

```bash
./node_modules/.bin/payload migrate
node server.js &
```

So any database problem at boot — stopped server, wrong password, blocked lock — kills the
container before the web server exists. Azure Container Apps then crash-loops it, which is why
`/health` intermittently answered while every database-backed route hung.

A stopped database should degrade the site (503s that recover on their own). Instead it wedged
it until the database stayed up for ~3 uninterrupted minutes.

### Contributing factors

1. **No Log Analytics workspace**, so `az containerapp logs show` only streams the live replica —
   several hours were spent inferring state from metrics.
2. **Password rotation was not atomic.** Interrupting `az postgres flexible-server update -p`
   leaves the database with the new password and the secret with the old one; the failure only
   surfaced as `28P01` in container logs.
3. **GitHub environment secrets could not be written from the operator's CLI** (403 "must have
   admin rights"), which pushed the change through the web UI where a paste can carry a newline.
4. **`prod` environment is misconfigured**: `RESOURCE_GROUP` points at `mfa-food-experience-test`
   and it holds 0 of 7 secrets. A prod dispatch would have deployed onto the test app.

## Detection

- Site monitoring: `/health` returned 200 while the app was unusable — **it does not touch the
  database**. This masked the outage.
- What actually showed it: PostgreSQL metrics (`active_connections` dropping to zero) and the
  Activity Log (`stop/action` events).

## Remediation applied

- `ReadOnly` resource lock `keep-test-db-running` on the PostgreSQL server, so no principal can
  stop it regardless of RBAC.
- Database password aligned with the deployed `DATABASE_URL`, verified by `connections_failed: 0`.

**The lock is a tourniquet, not a fix.** It also blocks password rotation and any server change;
remove it with:

```bash
az lock delete --name keep-test-db-running --resource "<server ARM id>"
```

## Durable fixes

### 1. Hermes must not stop these resources (Owner required)

Preferred, in order:

1. **Exclusion list** in the Hermes cost routine: never target resources tagged
   `project: mfa-food-experience` (or any client system that carries live bookings).
2. **Scope `hermes-agent`'s RBAC**: replace the subscription-wide Contributor assignment with a
   custom role that excludes `Microsoft.DBforPostgreSQL/flexibleServers/stop/action`, or restrict
   it to an explicit allowlist of resource groups.
3. **Locks on critical resources** across the subscription — see `infra/apply-resource-locks.sh`.

**Production must be excluded before it exists.** A cost routine that stops a production database
mid-payment is an outage plus lost revenue, not a saving.

Use this to see everything the principal has touched, before choosing:

```bash
az monitor activity-log list \
  --caller 1675b1ad-c2d3-4dac-af1c-e4b10539a2ac \
  --offset 7d --max-events 500 \
  --query "[].{time:eventTimestamp, op:operationName.value, rg:resourceGroupName, status:status.value}" \
  -o table
```

### 2. Migrations must not run at container start

`payload migrate` belongs in a dedicated Container App **job** run by `deploy.yml` *before* the
app update. Then:

- a database problem fails the deploy, and the **previous revision keeps serving**;
- the app never crash-loops on a schema problem;
- migrations are auditable as their own job.

This is the single change that would have turned this incident into a failed deploy.

### 3. Make `/health` mean something

A health endpoint that returns 200 while every real route hangs is worse than none. It should
either check the database (`select 1` with a short timeout) or be renamed to reflect that it is a
liveness probe only, with a separate readiness endpoint that does.

### 4. Attach Log Analytics

Without it, `az containerapp logs show` is limited to the live replica and history is lost on
restart. Provision a workspace per environment.

### 5. Rotate secrets atomically

A single script that resets the database password, writes the GitHub secret and redeploys, with
`gh auth` verified first and no interruption. Never split it across steps, and never paste a
connection string into a web form.
