# ── Stage 1: Dependencies ──────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# ── Stage 2: Build ─────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Build-time env: NEXT_PUBLIC_SERVER_URL is baked into client bundles at build.
# Set via `docker build --build-arg NEXT_PUBLIC_SERVER_URL=...`.
ARG NEXT_PUBLIC_SERVER_URL
ENV NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: Runtime ───────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache tini bash
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy the standalone build output (includes server.js and a pruned node_modules).
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# The standalone build prunes node_modules to only what `server.js` traces at
# runtime, which drops the `payload` CLI binary (`node_modules/.bin/payload`)
# and `tsx`.  `payload migrate` in the entrypoint needs both, plus the
# TypeScript config it loads, so copy the full dependency tree and source.
COPY --from=builder /app/node_modules ./node_modules

# Lexical v0.41.x `.mjs` files use top-level await (`const mod = await …`).
# tsx's CJS require hook converts those to `require()`, which Node.js v22+
# blocks with ERR_REQUIRE_ASYNC_MODULE.  Replace the dynamic dev/prod import
# with a static ESM import — harmless because NODE_ENV is always 'production'.
COPY infra/patch-lexical.js ./patch-lexical.js
RUN node ./patch-lexical.js && rm ./patch-lexical.js
COPY --from=builder /app/payload.config.ts ./payload.config.ts
COPY --from=builder /app/src ./src

# Replace tsconfig `@/` path aliases with relative imports.
# Payload's bundled tsx v4 does NOT resolve tsconfig.json `paths` at runtime,
# so `payload migrate` can't find `@/lib/…` imports inside collection files.
COPY infra/patch-paths.js ./patch-paths.js
RUN node ./patch-paths.js && rm ./patch-paths.js
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# tsx's CJS resolver (used by `payload migrate`) does not respect
# `moduleResolution: "bundler"` — it won't resolve extensionless `.ts`
# imports.  Keep `"bundler"` for the Next.js build in CI, but switch
# to `"node"` for the runtime container so tsx finds the config sources.
RUN sed -i 's/"moduleResolution": *"bundler"/"moduleResolution": "node"/' tsconfig.json
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/package.json ./package.json

# Copy the entrypoint that runs migrations before starting the server.
COPY infra/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./entrypoint.sh"]