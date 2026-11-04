#!/usr/bin/env bash
#
# infra/migrate.sh — apply Payload migrations, as a deploy-time job.
#
# WHY: until 2026-11-04 the container entrypoint ran `payload migrate` before
# starting Next.js, under `set -e`. When the database was stopped underneath a
# boot (see docs/incident-2026-11-04-test-database-outage.md), the container
# died before the web server existed and Container Apps crash-looped it -- a
# stopped database became a total outage.
#
# Run as it is here, a migration problem fails the DEPLOY while the previous
# revision keeps serving. That is the difference between a failed deploy and an
# outage.
#
# The Container App job runs this with the new image, so the schema is migrated
# by the code that expects it. Once the job is proven, set
# SKIP_BOOT_MIGRATIONS=true on the app so the entrypoint stops migrating.
#
# Requires: DATABASE_URL, PAYLOAD_SECRET (injected by the job as secretRefs).
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "migrate: DATABASE_URL is not set" >&2
  exit 1
fi

echo "=== Applying Payload migrations (deploy-time job) ==="
./node_modules/.bin/payload migrate
echo "=== Migrations applied ==="
