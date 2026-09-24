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
RUN node -e "
var fs=require('fs'),path=require('path');
function walk(dir){
  fs.readdirSync(dir,{withFileTypes:true}).forEach(function(d){
    var p=path.join(dir,d.name);
    if(d.isDirectory()&&!/node_modules/.test(p)) walk(p);
    else if(d.name.endsWith('.node.mjs')){
      var s=fs.readFileSync(p,'utf8');
      var m=s.match(/^const mod = await \(process\.env\.NODE_ENV !== 'production' \? import\('\.\/(.*)\\.dev\\.mjs'\) : import\('\.\/(.*)\\.prod\\.mjs'\)\);/m);
      if(m){ fs.writeFileSync(p, s.replace(m[0], 'import * as mod from \x27./'+m[2]+'.prod.mjs\x27;')); }
    }
  });
}
walk('node_modules/@lexical');
walk('node_modules/lexical');
"
COPY --from=builder /app/payload.config.ts ./payload.config.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
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