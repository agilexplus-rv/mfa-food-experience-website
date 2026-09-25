#!/usr/bin/env bash
# infra/entrypoint.sh — Container startup: run migrations, then start the app.
#
# Payload's `payload migrate` applies pending migrations at startup so every
# deploy is self-contained.  On first deploy against an empty database, the
# seed script is also run (it is idempotent — skips when data already exists).
set -euo pipefail

echo "=== Running Payload migrations ==="
# Lexical v0.41 TOP-LEVEL AWAIT PATCH: the Dockerfile replaces the dynamic
# `const mod = await …` dev/prod imports in lexical `.mjs` files with static
# `import * as mod from` — otherwise tsx's CJS require hook hits Node v22's
# ERR_REQUIRE_ASYNC_MODULE guard.
./node_modules/.bin/payload migrate

echo "=== Starting Next.js server (background, then seed) ==="
node server.js &
SERVER_PID=$!

# Wait for the server to be ready (up to 60 seconds).
echo "Waiting for server to become ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "Server ready after ${i}s"
    break
  fi
  sleep 2
done

echo "=== Seeding database (idempotent — skips existing data) ==="
curl -sf -X POST http://localhost:3000/api/seed 2>&1 || echo "Seed endpoint returned non-zero (may be OK if already seeded)"

echo "=== Seed complete, bringing server to foreground ==="
wait $SERVER_PID
