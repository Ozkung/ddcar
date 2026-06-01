# Phase 3A: Monorepo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single Next.js app into a pnpm + Turborepo monorepo with `apps/shop` (existing app) and `packages/db` (shared Prisma client), so Phase 3B can add the admin portal as `apps/admin-portal`.

**Architecture:** The root becomes a pnpm workspace. The current app moves to `apps/shop/`. Prisma schema + client move to `packages/db/` and are exported as `@ddcar/db`. `apps/shop/src/lib/prisma.ts` becomes a one-line re-export shim so all ~30 existing `@/lib/prisma` imports need no changes. pnpm's `shamefully-hoist=true` ensures all node_modules are hoisted to root, keeping the Prisma client resolution simple and the Docker build straightforward.

**Tech Stack:** pnpm 9 (workspaces), Turborepo 2, Next.js 14, Prisma 5, TypeScript 5

---

## File Map

Files being **created**:
- `pnpm-workspace.yaml` — declares workspace packages
- `.npmrc` — enables shamefully-hoist for pnpm
- `turbo.json` — Turborepo task pipeline
- `package.json` (root, replaces existing) — workspace root with turbo dev dep
- `packages/db/package.json` — `@ddcar/db` package manifest
- `packages/db/tsconfig.json` — TypeScript config for the db package
- `packages/db/src/index.ts` — exports `prisma` singleton + re-exports `@prisma/client` types
- `apps/shop/package.json` — shop app manifest with `@ddcar/db: workspace:*`

Files being **moved** (use `git mv` to preserve history):
- `prisma/` → `packages/db/prisma/`
- `src/` → `apps/shop/src/`
- `public/` → `apps/shop/public/`
- `next.config.mjs` → `apps/shop/next.config.mjs`
- `tsconfig.json` → `apps/shop/tsconfig.json`
- `jest.config.ts` → `apps/shop/jest.config.ts`
- `next-env.d.ts` → `apps/shop/next-env.d.ts`
- `Dockerfile` → `apps/shop/Dockerfile`
- `scripts/` → `apps/shop/scripts/`

Files being **modified**:
- `apps/shop/tsconfig.json` — add `@ddcar/db` path alias
- `apps/shop/jest.config.ts` — add `@ddcar/db` moduleNameMapper entry
- `apps/shop/src/lib/prisma.ts` — replace with 3-line re-export shim
- `apps/shop/Dockerfile` — rewrite for monorepo build context
- `apps/shop/scripts/entrypoint.sh` — update prisma schema path
- `docker-compose.yml` — update build context + dockerfile path
- `package.json` (root) — replace entirely

Files **staying at root** (no change): `docker-compose.yml` (structure), `nginx/`, `docs/`, `Plan.html`

---

## Task 1: Root Workspace Scaffolding

**Files:**
- Create: `package.json` (root — replaces existing)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.npmrc`

- [ ] **Step 1: Overwrite root `package.json` with workspace config**

```json
{
  "name": "ddcar-monorepo",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "pnpm --filter @ddcar/shop dev",
    "build": "pnpm --filter @ddcar/shop build",
    "test": "pnpm --filter @ddcar/shop test",
    "db:generate": "pnpm --filter @ddcar/db run generate",
    "db:push": "pnpm --filter @ddcar/db run db:push"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  }
}
```

Save to: `package.json` (root, overwrite).

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Save to: `pnpm-workspace.yaml`

- [ ] **Step 3: Create `.npmrc`**

```
shamefully-hoist=true
```

Save to: `.npmrc`

This makes pnpm hoist all dependencies to root `node_modules/`, matching npm's behavior and ensuring `@prisma/client` is findable by `apps/shop` without being listed as its direct dep.

- [ ] **Step 4: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "outputs": ["coverage/**"]
    },
    "generate": {
      "cache": false
    }
  }
}
```

Save to: `turbo.json`

- [ ] **Step 5: Commit scaffolding**

```bash
git add package.json pnpm-workspace.yaml .npmrc turbo.json
git commit -m "chore: monorepo workspace scaffolding (pnpm + turbo)"
```

---

## Task 2: Create `packages/db`

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/index.ts`
- Move: `prisma/` → `packages/db/prisma/`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p packages/db/src
```

- [ ] **Step 2: Move `prisma/` into `packages/db/`**

```bash
git mv prisma packages/db/prisma
```

Verify: `ls packages/db/prisma/` should show `schema.prisma` and `migrations/`.

- [ ] **Step 3: Create `packages/db/package.json`**

```json
{
  "name": "@ddcar/db",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "generate": "prisma generate",
    "db:push": "prisma db push"
  },
  "dependencies": {
    "@prisma/client": "^5.15.0"
  },
  "devDependencies": {
    "prisma": "^5.15.0",
    "typescript": "^5.4.5"
  }
}
```

Save to: `packages/db/package.json`

- [ ] **Step 4: Create `packages/db/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Save to: `packages/db/tsconfig.json`

- [ ] **Step 5: Create `packages/db/src/index.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export * from '@prisma/client'
```

Save to: `packages/db/src/index.ts`

The `export * from '@prisma/client'` lets consumers do `import type { Role } from '@ddcar/db'` instead of importing from `@prisma/client` directly. Existing `@prisma/client` imports in `apps/shop` continue to work via hoisting.

- [ ] **Step 6: Commit**

```bash
git add packages/
git commit -m "feat: create packages/db with shared Prisma client"
```

---

## Task 3: Move Shop App to `apps/shop`

**Files:**
- Move: `src/ public/ next.config.mjs tsconfig.json jest.config.ts next-env.d.ts Dockerfile scripts/` → `apps/shop/`
- Create: `apps/shop/package.json`

- [ ] **Step 1: Create `apps/shop/` directory**

```bash
mkdir -p apps/shop
```

- [ ] **Step 2: Move all shop files**

```bash
git mv src apps/shop/src
git mv public apps/shop/public
git mv next.config.mjs apps/shop/next.config.mjs
git mv tsconfig.json apps/shop/tsconfig.json
git mv jest.config.ts apps/shop/jest.config.ts
git mv next-env.d.ts apps/shop/next-env.d.ts
git mv Dockerfile apps/shop/Dockerfile
git mv scripts apps/shop/scripts
```

Verify: `ls apps/shop/` should show `src public next.config.mjs tsconfig.json jest.config.ts next-env.d.ts Dockerfile scripts`.

- [ ] **Step 3: Create `apps/shop/package.json`**

```json
{
  "name": "@ddcar/shop",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "jest"
  },
  "dependencies": {
    "@ant-design/cssinjs": "^2.1.2",
    "@ant-design/icons": "^5.3.7",
    "@ant-design/nextjs-registry": "^1.0.1",
    "@ddcar/db": "workspace:*",
    "@ducanh2912/next-pwa": "^10.2.9",
    "@prisma/client": "^5.15.0",
    "antd": "^5.18.0",
    "bcryptjs": "^3.0.3",
    "dayjs": "^1.11.11",
    "next": "^14.2.3",
    "next-auth": "^5.0.0-beta.31",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.7"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "jest": "^29.7.0",
    "jest-environment-node": "^29.7.0",
    "prisma": "^5.15.0",
    "ts-jest": "^29.1.4",
    "ts-node": "^10.9.2",
    "typescript": "^5.4.5"
  }
}
```

Save to: `apps/shop/package.json`

Note: `@ddcar/db: "workspace:*"` is the pnpm workspace protocol — resolves to `packages/db` locally. `@prisma/client` stays as a direct dep so TypeScript can find Prisma types without relying solely on hoisting.

- [ ] **Step 4: Update `apps/shop/tsconfig.json` — add `@ddcar/db` path**

Open `apps/shop/tsconfig.json`. Find the `paths` section and add `@ddcar/db`:

Before:
```json
"paths": { "@/*": ["./src/*"] }
```

After:
```json
"paths": {
  "@/*": ["./src/*"],
  "@ddcar/db": ["../../packages/db/src/index.ts"]
}
```

This tells TypeScript exactly where `@ddcar/db` lives regardless of pnpm symlink resolution.

- [ ] **Step 5: Update `apps/shop/jest.config.ts` — add `@ddcar/db` mapper**

Open `apps/shop/jest.config.ts`. Add `@ddcar/db` to `moduleNameMapper`:

Before:
```typescript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
},
```

After:
```typescript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@ddcar/db$': '<rootDir>/../../packages/db/src/index.ts',
},
```

- [ ] **Step 6: Commit the move**

```bash
git add apps/ packages/db/prisma
git rm package-lock.json
git commit -m "chore: move shop app to apps/shop, prisma to packages/db/prisma"
```

Note: `package-lock.json` is removed because we're switching to pnpm. `pnpm-lock.yaml` will be added in the next task.

---

## Task 4: Install Dependencies + Verify Dev Server

**Files:**
- Create: `pnpm-lock.yaml` (generated)
- Modify: `apps/shop/src/lib/prisma.ts` (re-export shim)

- [ ] **Step 1: Enable pnpm via corepack**

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

Expected: `pnpm --version` prints `9.15.0` (or close).

If corepack is unavailable: `npm install -g pnpm@9`

- [ ] **Step 2: Install all workspace dependencies**

Run from the monorepo root (`/Users/tae/Desktop/playground/ddcar`):

```bash
pnpm install
```

Expected output ends with something like:
```
packages/db: devDependencies
  + prisma 5.x.x
  + typescript 5.x.x

apps/shop:
  + @ddcar/db 0.0.0 <- packages/db

Done in Xs
```

This creates `pnpm-lock.yaml` at root and `node_modules/` at root (hoisted, since `.npmrc` has `shamefully-hoist=true`).

- [ ] **Step 3: Generate the Prisma client**

```bash
pnpm db:generate
```

Which runs `pnpm --filter @ddcar/db run generate` → `prisma generate` with `packages/db/prisma/schema.prisma`.

Expected: ends with `✔ Generated Prisma Client (v5.x.x) to .../node_modules/.prisma/client`

- [ ] **Step 4: Copy your `.env` file to `apps/shop/`**

```bash
cp .env apps/shop/.env 2>/dev/null || cp .env.local apps/shop/.env.local 2>/dev/null || true
```

Next.js in `apps/shop/` looks for `.env.local` relative to `apps/shop/`. The root `.env` is no longer picked up by the dev server.

- [ ] **Step 5: Replace `apps/shop/src/lib/prisma.ts` with a re-export shim**

```typescript
export { prisma } from '@ddcar/db'
```

This single line replaces the whole file. All ~30 existing `import { prisma } from '@/lib/prisma'` calls in `apps/shop/src/` keep working with no changes.

- [ ] **Step 6: Run tests**

```bash
pnpm test
```

Which runs `pnpm --filter @ddcar/shop test` → jest.

Expected:
```
PASS src/lib/__tests__/refCode.test.ts
PASS src/lib/__tests__/jobNo.test.ts

Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
```

If tests fail with "Cannot find module '@ddcar/db'": check `apps/shop/jest.config.ts` moduleNameMapper has `'^@ddcar/db$': '<rootDir>/../../packages/db/src/index.ts'`.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd apps/shop && npx tsc --noEmit && cd ../..
```

Expected: no output (zero errors).

Common issue: if TypeScript can't find `@ddcar/db`, check `apps/shop/tsconfig.json` has `"@ddcar/db": ["../../packages/db/src/index.ts"]` in paths.

- [ ] **Step 8: Verify dev server starts**

```bash
pnpm dev
```

Open `http://localhost:3000` — the app should load identically to before. If you see a blank page or errors, check that `apps/shop/.env.local` has `DATABASE_URL` set.

Press Ctrl+C to stop.

- [ ] **Step 9: Commit**

```bash
git add apps/shop/src/lib/prisma.ts pnpm-lock.yaml apps/shop/.env.local
git commit -m "chore: switch to pnpm, wire @ddcar/db, update prisma shim"
```

Note: only commit `.env.local` if it contains no secrets (it shouldn't be in `.gitignore` for this project, but double-check).

Actually — **do NOT commit `.env.local`**. Check `.gitignore` first:
```bash
grep -i "env" .gitignore
```
If `.env.local` is gitignored, skip it from the commit. Commit only:
```bash
git add apps/shop/src/lib/prisma.ts pnpm-lock.yaml
git commit -m "chore: switch to pnpm, wire @ddcar/db, update prisma shim"
```

---

## Task 5: Update Docker Infrastructure

**Files:**
- Modify: `apps/shop/Dockerfile`
- Modify: `apps/shop/scripts/entrypoint.sh`
- Modify: `docker-compose.yml`

The Dockerfile build context is now the monorepo root (not `apps/shop/`). This is required because `packages/db/` must be included in the build.

- [ ] **Step 1: Rewrite `apps/shop/Dockerfile`**

```dockerfile
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
# .pnpm/ virtual store is included inside node_modules/; symlinks remain relative
COPY --from=builder --chown=nextjs:nodejs /app/node_modules          ./node_modules

# packages/db needed at runtime for Prisma client + schema
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/src       ./packages/db/src
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/prisma    ./packages/db/prisma
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/package.json ./packages/db/package.json

# Root package.json (needed by pnpm workspace resolution at runtime)
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
```

Save to: `apps/shop/Dockerfile`

- [ ] **Step 2: Rewrite `apps/shop/scripts/entrypoint.sh`**

```sh
#!/bin/sh
set -e

echo "▶ Syncing database schema..."
./node_modules/.bin/prisma db push --skip-generate \
  --schema=./packages/db/prisma/schema.prisma

echo "▶ Starting Next.js..."
cd /app/apps/shop
exec /app/node_modules/.bin/next start
```

Save to: `apps/shop/scripts/entrypoint.sh`

The `--schema` flag tells Prisma where to find the schema. The `cd /app/apps/shop` ensures `next start` finds `.next/` and `public/` in the right place.

- [ ] **Step 3: Update `docker-compose.yml`**

Change the `app` service build section:

Before:
```yaml
  app:
    build:
      context: .
      dockerfile: Dockerfile
```

After:
```yaml
  app:
    build:
      context: .
      dockerfile: apps/shop/Dockerfile
```

Everything else in `docker-compose.yml` stays the same (volumes, environment, ports).

- [ ] **Step 4: Verify Docker build (optional but recommended)**

```bash
docker build -f apps/shop/Dockerfile . -t ddcar-shop-test
```

Expected: build completes without error. Final image size should be similar to before (~500MB).

If build fails with "pnpm: not found" in deps stage, the corepack prepare step failed — try `RUN npm install -g pnpm@9.15.0` instead.

If build fails with "Cannot find schema" in entrypoint, verify `packages/db/prisma/schema.prisma` exists at that path.

- [ ] **Step 5: Commit**

```bash
git add apps/shop/Dockerfile apps/shop/scripts/entrypoint.sh docker-compose.yml
git commit -m "chore: update Dockerfile + entrypoint for monorepo build context"
```

---

## Task 6: Final Verification + Cleanup

**Files:** None new — verification only.

- [ ] **Step 1: Run full test suite from root**

```bash
pnpm test
```

Expected:
```
@ddcar/shop:test: PASS src/lib/__tests__/refCode.test.ts
@ddcar/shop:test: PASS src/lib/__tests__/jobNo.test.ts
@ddcar/shop:test: Tests: 8 passed, 8 total
```

- [ ] **Step 2: Verify TypeScript (no errors)**

```bash
cd apps/shop && npx tsc --noEmit 2>&1 | head -30
cd ../..
```

Expected: no output.

- [ ] **Step 3: Verify dev server one more time**

```bash
pnpm dev
```

Open `http://localhost:3000/login` — app loads, login works, nav appears. Press Ctrl+C.

- [ ] **Step 4: Final commit**

```bash
git add -A
git status  # verify only expected files
git commit -m "chore: Phase 3A monorepo restructure complete"
```

Expected git status should show no unexpected changes — just `pnpm-lock.yaml` if not already committed.

---

## Troubleshooting Reference

**"Module not found: @ddcar/db"** (TypeScript)
→ Check `apps/shop/tsconfig.json` paths: `"@ddcar/db": ["../../packages/db/src/index.ts"]`

**"Module not found: @ddcar/db"** (Jest)
→ Check `apps/shop/jest.config.ts` moduleNameMapper: `'^@ddcar/db$': '<rootDir>/../../packages/db/src/index.ts'`

**Prisma generate fails**
→ Run `pnpm install` first. Then `pnpm db:generate`. Prisma must find `packages/db/prisma/schema.prisma`.

**Dev server: "Cannot find module 'next'"**
→ pnpm hoisting may have failed. Run `pnpm install` again. Check `.npmrc` has `shamefully-hoist=true`.

**Dev server: DATABASE_URL error**
→ Copy root `.env` to `apps/shop/.env`: `cp .env apps/shop/.env`

**Docker build: "pnpm not found"**
→ Replace `corepack prepare pnpm@9.15.0 --activate` with `npm install -g pnpm@9.15.0`

**Docker: next start fails ("not a Next.js project")**
→ The `cd /app/apps/shop` in `entrypoint.sh` must happen before `next start`. Verify the entrypoint was updated.
