#!/usr/bin/env bash
# infra/entrypoint.sh — Container startup: run migrations, then start the app.
#
# Payload's `payload migrate` applies pending migrations at startup so every
# deploy is self-contained.  On first deploy against an empty database, the
# seed script is also run (it is idempotent — skips when data already exists).
set -euo pipefail

# ── Migrations ────────────────────────────────────────────────────
# Incident 2026-11-04: the database was stopped underneath this container
# several times. Because migrations ran here, under `set -e`, every boot died
# before Next.js existed and Container Apps crash-looped the replica — a
# stopped database became a total outage.
#
# Migrations still run here by default (so a deploy remains self-contained),
# but they are now attempted in bounded retries rather than once. A brief
# database blip therefore costs a few seconds of start time instead of a crash
# loop, and a hard failure prints one greppable marker before exiting.
#
# The durable fix is to run migrations as a deploy-time job and set
# SKIP_BOOT_MIGRATIONS=true (see docs/incident-2026-11-04-test-database-outage.md).
if [ "${SKIP_BOOT_MIGRATIONS:-false}" = "true" ]; then
  echo "=== Skipping boot migrations (SKIP_BOOT_MIGRATIONS=true) ==="
else
  echo "=== Running Payload migrations ==="
  attempt=1
  max_attempts=5
  until ./node_modules/.bin/payload migrate; do
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "=== MIGRATION_FAILED: giving up after ${max_attempts} attempts ===" >&2
      exit 1
    fi
    echo "=== Migration attempt ${attempt}/${max_attempts} failed; retrying in 15s ===" >&2
    attempt=$((attempt + 1))
    sleep 15
  done
  echo "=== Migrations complete ==="
fi

echo "=== Starting Next.js server (background, then seed) ==="
# A fresh random key for this start only: the seed endpoint runs only with it,
# so nobody outside the container can trigger the seed.
SEED_INTERNAL_TOKEN=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
export SEED_INTERNAL_TOKEN
node server.js &
SERVER_PID=$!

# Wait for the server to be ready (up to 60 seconds).
echo "Waiting for server to become ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "Server ready after ${i}s"
    break
  fi
  sleep 2
done

echo "=== Seeding database (idempotent — skips existing data) ==="
curl -sf -X POST -H "x-seed-token: ${SEED_INTERNAL_TOKEN}" http://localhost:3000/seed-internal 2>&1 || echo "Seed endpoint returned non-zero (may be OK if already seeded)"

echo "=== Seed complete, bringing server to foreground ==="
wait $SERVER_PID
