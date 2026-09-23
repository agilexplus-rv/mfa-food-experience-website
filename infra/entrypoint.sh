#!/usr/bin/env bash
# infra/entrypoint.sh — Container startup: run migrations, then start the app.
#
# Payload's `payload migrate` applies pending migrations at startup so every
# deploy is self-contained.  On first deploy against an empty database, the
# seed script is also run (it is idempotent — skips when data already exists).
set -euo pipefail

echo "=== Running Payload migrations ==="
npx payload migrate

echo "=== Starting Next.js server ==="
exec node server.js