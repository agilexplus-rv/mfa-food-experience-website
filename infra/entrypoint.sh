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

echo "=== Seeding database (idempotent — skips existing data) ==="
npx tsx src/payload/seed.ts

echo "=== Starting Next.js server ==="
exec node server.js
