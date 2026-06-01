# ── Stage 1: install deps ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy manifests for dependency resolution (layer cache optimization)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/db/package.json ./packages/db/package.json
COPY apps/shop/package.json ./apps/shop/package.json
RUN pnpm install --frozen-lockfile

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/shop/node_modules ./apps/shop/node_modules
COPY . .

RUN pnpm db:generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @ddcar/shop build

# ── Stage 3: production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Shop app output
COPY --from=builder --chown=nextjs:nodejs /app/apps/shop/public      ./apps/shop/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/shop/.next       ./apps/shop/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/shop/package.json ./apps/shop/package.json

# Shared node_modules (hoisted by pnpm .npmrc shamefully-hoist=true)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules          ./node_modules

# packages/db needed at runtime for Prisma client + schema
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/src       ./packages/db/src
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/prisma    ./packages/db/prisma
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/package.json ./packages/db/package.json

# Root package.json
COPY --from=builder --chown=nextjs:nodejs /app/package.json           ./package.json

# Entrypoint
COPY --chown=nextjs:nodejs apps/shop/scripts/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

RUN mkdir -p /uploads && chown nextjs:nodejs /uploads
RUN chown -R nextjs:nodejs /app/node_modules/@prisma /app/node_modules/.prisma 2>/dev/null || true

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./entrypoint.sh"]
