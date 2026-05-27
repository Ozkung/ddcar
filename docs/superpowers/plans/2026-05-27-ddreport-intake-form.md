# DDReport — Intake Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Thai-language car-repair intake form (ดีดีช่างยนต์) with a 5-step wizard, report table, print receipt, image upload, and Docker production setup at `http://ddreport.local`.

**Architecture:** Next.js 14 App Router, Ant Design 5 UI, Prisma + PostgreSQL for data, uploaded images on a named Docker volume. Nginx reverse-proxies `:80` → Next.js container on `:3000`. One-time `/etc/hosts` entry maps `ddreport.local` to `127.0.0.1`.

**Tech Stack:** Next.js 14, React 18, Ant Design 5, `@ant-design/nextjs-registry`, Prisma 5, PostgreSQL 16-alpine, Docker Compose, Nginx-alpine, TypeScript, Jest + ts-jest

---

## File Map

```
ddcar/
├── package.json
├── tsconfig.json
├── next.config.ts
├── jest.config.ts
├── .env                                    # local dev DB URL
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
├── scripts/
│   └── entrypoint.sh
├── prisma/
│   └── schema.prisma
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx                      # AntdRegistry + Sarabun font + nav
    │   ├── page.tsx                        # 5-step intake form (client)
    │   ├── report/
    │   │   └── page.tsx                    # job table + filters + CSV export (client)
    │   ├── receipt/
    │   │   └── [id]/
    │   │       └── page.tsx                # print receipt (server)
    │   └── api/
    │       ├── jobs/
    │       │   ├── route.ts                # POST + GET /api/jobs
    │       │   ├── [id]/
    │       │   │   └── images/
    │       │   │       └── route.ts        # POST /api/jobs/[id]/images
    │       │   └── export/
    │       │       └── route.ts            # GET /api/jobs/export (CSV)
    │       └── uploads/
    │           └── [...path]/
    │               └── route.ts            # GET /api/uploads/[...path]
    └── lib/
        ├── prisma.ts                       # Prisma client singleton
        ├── jobNo.ts                        # job number generator
        └── __tests__/
            └── jobNo.test.ts
```

---

## Task 1: Project bootstrap

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `jest.config.ts`
- Create: `.gitignore`
- Create: `.env`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ddreport",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "jest"
  },
  "dependencies": {
    "next": "^14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "antd": "^5.18.0",
    "@ant-design/icons": "^5.3.7",
    "@ant-design/nextjs-registry": "^1.0.1",
    "@prisma/client": "^5.15.0",
    "dayjs": "^1.11.11"
  },
  "devDependencies": {
    "prisma": "^5.15.0",
    "typescript": "^5.4.5",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.12",
    "ts-jest": "^29.1.4",
    "jest-environment-node": "^29.7.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
}

export default nextConfig
```

- [ ] **Step 4: Create `jest.config.ts`**

```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
}

export default config
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
.next/
.env
.env.production
```

- [ ] **Step 6: Create `.env`** (local dev only — NOT committed)

```
DATABASE_URL="postgresql://ddreport:ddreport_pass@localhost:5432/ddreport"
UPLOADS_DIR="/tmp/ddreport-uploads"
```

- [ ] **Step 7: Install dependencies**

```bash
cd /Users/tae/Desktop/playground/ddcar
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json next.config.ts jest.config.ts .gitignore
git commit -m "chore: bootstrap Next.js project with Ant Design + Prisma deps"
```

---

## Task 2: Prisma schema

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Job {
  id           String   @id @default(cuid())
  jobNo        String   @unique
  date         String
  time         String
  customerName String
  phone        String
  licensePlate String
  odometer     Int
  symptoms     String[]
  notes        String?
  cause        String
  totalPrice   Float
  status       String
  createdAt    DateTime @default(now())
  images       Image[]
}

model Image {
  id        String   @id @default(cuid())
  jobId     String
  filename  String
  createdAt DateTime @default(now())
  job       Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` success message.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Prisma schema — Job and Image models"
```

---

## Task 3: Docker infrastructure

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `nginx/nginx.conf`
- Create: `scripts/entrypoint.sh`

- [ ] **Step 1: Create `Dockerfile`**

```dockerfile
# ── Stage 1: install deps ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# App files
COPY --from=builder /app/public          ./public
COPY --from=builder /app/.next           ./.next
COPY --from=builder /app/node_modules    ./node_modules
COPY --from=builder /app/package.json    ./package.json
COPY --from=builder /app/prisma          ./prisma

# Entrypoint script
COPY scripts/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Uploads directory (overridden by Docker volume at runtime)
RUN mkdir -p /uploads && chown nextjs:nodejs /uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./entrypoint.sh"]
CMD ["npm", "start"]
```

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ddreport
      POSTGRES_PASSWORD: ddreport_pass
      POSTGRES_DB: ddreport
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ddreport -d ddreport"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://ddreport:ddreport_pass@postgres:5432/ddreport
      NODE_ENV: production
      UPLOADS_DIR: /uploads
    volumes:
      - uploads_data:/uploads
    depends_on:
      postgres:
        condition: service_healthy

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app

volumes:
  pg_data:
  uploads_data:
```

- [ ] **Step 3: Create `nginx/nginx.conf`**

```nginx
server {
    listen 80;
    server_name ddreport.local;

    # Increase body size limit for image uploads (10 images × 5 MB)
    client_max_body_size 55M;

    location / {
        proxy_pass         http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

- [ ] **Step 4: Create `scripts/entrypoint.sh`**

```bash
#!/bin/sh
set -e

echo "▶ Running Prisma migrations..."
./node_modules/.bin/prisma migrate deploy

echo "▶ Starting Next.js..."
exec "$@"
```

- [ ] **Step 5: Make entrypoint executable**

```bash
chmod +x scripts/entrypoint.sh
```

- [ ] **Step 6: Commit**

```bash
git add Dockerfile docker-compose.yml nginx/nginx.conf scripts/entrypoint.sh
git commit -m "feat: add Docker production setup — nginx + app + postgres"
```

---

## Task 4: Root layout + globals

**Files:**
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/app/globals.css`**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  font-family: 'Sarabun', sans-serif;
}

@media print {
  .no-print {
    display: none !important;
  }
}
```

- [ ] **Step 2: Create `src/app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Sarabun } from 'next/font/google'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
import thTH from 'antd/locale/th_TH'
import Link from 'next/link'
import './globals.css'

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ดีดีช่างยนต์',
  description: 'ระบบรับรถเข้าซ่อม',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className={sarabun.className}>
        <AntdRegistry>
          <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'Sarabun, sans-serif' } }}>
            <nav style={{
              background: '#2563eb',
              padding: '0.75rem 1.5rem',
              display: 'flex',
              gap: '1.5rem',
              alignItems: 'center',
            }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>
                🔧 ดีดีช่างยนต์
              </span>
              <Link href="/" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                รับรถเข้าซ่อม
              </Link>
              <Link href="/report" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                รายงาน
              </Link>
            </nav>
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: root layout — AntdRegistry, Thai locale, Sarabun font, nav bar"
```

---

## Task 5: Lib utilities

**Files:**
- Create: `src/lib/prisma.ts`
- Create: `src/lib/jobNo.ts`
- Create: `src/lib/__tests__/jobNo.test.ts`

- [ ] **Step 1: Create `src/lib/prisma.ts`**

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
```

- [ ] **Step 2: Create `src/lib/jobNo.ts`**

```typescript
import { prisma } from './prisma'

/**
 * Generates a unique job number for the given date.
 * Format: DD-YYYYMMDD-NNN (e.g. DD-20260527-001)
 * NNN = (count of jobs already on that date) + 1, zero-padded to 3 digits.
 */
export async function generateJobNo(date: string): Promise<string> {
  const datePart = date.replace(/-/g, '') // "2026-05-27" → "20260527"
  const count = await prisma.job.count({ where: { date } })
  const seq = String(count + 1).padStart(3, '0')
  return `DD-${datePart}-${seq}`
}
```

- [ ] **Step 3: Write failing test — `src/lib/__tests__/jobNo.test.ts`**

```typescript
jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      count: jest.fn(),
    },
  },
}))

import { generateJobNo } from '@/lib/jobNo'
import { prisma } from '@/lib/prisma'

const mockCount = prisma.job.count as jest.Mock

describe('generateJobNo', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns DD-20260527-001 for the first job on a date', async () => {
    mockCount.mockResolvedValue(0)
    const result = await generateJobNo('2026-05-27')
    expect(result).toBe('DD-20260527-001')
    expect(mockCount).toHaveBeenCalledWith({ where: { date: '2026-05-27' } })
  })

  it('returns DD-20260527-006 when 5 jobs already exist on that date', async () => {
    mockCount.mockResolvedValue(5)
    const result = await generateJobNo('2026-05-27')
    expect(result).toBe('DD-20260527-006')
  })

  it('pads sequence to 3 digits for seq < 10', async () => {
    mockCount.mockResolvedValue(2)
    const result = await generateJobNo('2026-01-01')
    expect(result).toBe('DD-20260101-003')
  })

  it('strips hyphens from the date part', async () => {
    mockCount.mockResolvedValue(0)
    const result = await generateJobNo('2026-12-31')
    expect(result).toMatch(/^DD-20261231-\d{3}$/)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npx jest src/lib/__tests__/jobNo.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/jobNo'`

- [ ] **Step 5: Run test again after creating the files**

```bash
npx jest src/lib/__tests__/jobNo.test.ts --no-coverage
```

Expected: PASS — 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/prisma.ts src/lib/jobNo.ts src/lib/__tests__/jobNo.test.ts
git commit -m "feat: add Prisma singleton and jobNo generator with tests"
```

---

## Task 6: POST + GET /api/jobs

**Files:**
- Create: `src/app/api/jobs/route.ts`

- [ ] **Step 1: Create `src/app/api/jobs/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateJobNo } from '@/lib/jobNo'

/* ─── POST /api/jobs ─────────────────────────────────────────────────────── */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      date, time, customerName, phone,
      licensePlate, odometer, symptoms,
      notes, cause, totalPrice, status,
    } = body

    const missing = [date, time, customerName, phone, licensePlate, odometer, cause, totalPrice, status]
      .some(v => v === undefined || v === null || v === '')

    if (missing) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 422 })
    }

    const jobNo = await generateJobNo(date as string)

    const job = await prisma.job.create({
      data: {
        jobNo,
        date: String(date),
        time: String(time),
        customerName: String(customerName),
        phone: String(phone),
        licensePlate: String(licensePlate),
        odometer: Number(odometer),
        symptoms: Array.isArray(symptoms) ? symptoms : [],
        notes: notes ? String(notes) : null,
        cause: String(cause),
        totalPrice: Number(totalPrice),
        status: String(status),
      },
    })

    return NextResponse.json({ id: job.id, jobNo: job.jobNo }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/jobs]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/* ─── GET /api/jobs ──────────────────────────────────────────────────────── */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page     = Math.max(1, Number(searchParams.get('page')     || '1'))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '20')))
  const search   = searchParams.get('search')   || ''
  const status   = searchParams.get('status')   || ''
  const dateFrom = searchParams.get('dateFrom') || ''
  const dateTo   = searchParams.get('dateTo')   || ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: 'insensitive' } },
      { licensePlate: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (status)   where.status = status
  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) where.date.gte = dateFrom
    if (dateTo)   where.date.lte = dateTo
  }

  const [data, total] = await Promise.all([
    prisma.job.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { images: { select: { id: true, filename: true } } },
    }),
    prisma.job.count({ where }),
  ])

  return NextResponse.json({ data, total, page, pageSize })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/jobs/route.ts
git commit -m "feat: POST + GET /api/jobs — create job, list with filters + pagination"
```

---

## Task 7: GET /api/jobs/export (CSV)

**Files:**
- Create: `src/app/api/jobs/export/route.ts`

- [ ] **Step 1: Create `src/app/api/jobs/export/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function csvEscape(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search   = searchParams.get('search')   || ''
  const status   = searchParams.get('status')   || ''
  const dateFrom = searchParams.get('dateFrom') || ''
  const dateTo   = searchParams.get('dateTo')   || ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: 'insensitive' } },
      { licensePlate: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (status)   where.status = status
  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) where.date.gte = dateFrom
    if (dateTo)   where.date.lte = dateTo
  }

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  const HEADERS = [
    'jobNo','date','time','customerName','phone',
    'licensePlate','odometer','symptoms','notes',
    'cause','totalPrice','status','createdAt',
  ]

  const rows = jobs.map(j =>
    [
      j.jobNo, j.date, j.time, j.customerName, j.phone,
      j.licensePlate, j.odometer, j.symptoms.join('; '), j.notes ?? '',
      j.cause, j.totalPrice, j.status, j.createdAt.toISOString(),
    ].map(csvEscape).join(',')
  )

  const csv = '﻿' + [HEADERS.join(','), ...rows].join('\r\n') // BOM for Excel Thai
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="jobs-${dateStamp}.csv"`,
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/jobs/export/route.ts
git commit -m "feat: GET /api/jobs/export — CSV download with active filters, UTF-8 BOM"
```

---

## Task 8: POST /api/jobs/[id]/images

**Files:**
- Create: `src/app/api/jobs/[id]/images/route.ts`

- [ ] **Step 1: Create `src/app/api/jobs/[id]/images/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'

const UPLOADS_DIR  = process.env.UPLOADS_DIR  || '/uploads'
const MAX_FILES    = 10
const MAX_SIZE     = 5 * 1024 * 1024           // 5 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const job = await prisma.job.findUnique({ where: { id: params.id } })
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const formData = await request.formData()
  const files = formData.getAll('images') as File[]

  if (files.length === 0) {
    return NextResponse.json({ uploaded: 0 }, { status: 200 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} images per job` }, { status: 422 })
  }

  const jobDir = path.join(UPLOADS_DIR, params.id)
  await mkdir(jobDir, { recursive: true })

  const records: { jobId: string; filename: string }[] = []

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 422 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File too large: ${file.name} (max 5 MB)` }, { status: 422 })
    }

    const ext      = EXT_MAP[file.type]
    const filename = `${randomUUID()}.${ext}`
    const buffer   = Buffer.from(await file.arrayBuffer())

    await writeFile(path.join(jobDir, filename), buffer)
    records.push({ jobId: params.id, filename })
  }

  await prisma.image.createMany({ data: records })

  return NextResponse.json({ uploaded: records.length }, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/jobs/[id]/images/route.ts
git commit -m "feat: POST /api/jobs/[id]/images — multipart upload to Docker volume"
```

---

## Task 9: GET /api/uploads/[...path]

**Files:**
- Create: `src/app/api/uploads/[...path]/route.ts`

- [ ] **Step 1: Create `src/app/api/uploads/[...path]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/uploads'

const CONTENT_TYPES: Record<string, string> = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const requested = path.join(UPLOADS_DIR, ...params.path)
    const resolved  = path.resolve(requested)
    const base      = path.resolve(UPLOADS_DIR)

    // Prevent path traversal attacks
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const buffer      = await readFile(resolved)
    const ext         = path.extname(resolved).slice(1).toLowerCase()
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/uploads/[...path]/route.ts
git commit -m "feat: GET /api/uploads/[...path] — serve images with path-traversal guard"
```

---

## Task 10: 5-step intake form page

**Files:**
- Create: `src/app/page.tsx`

- [ ] **Step 1: Create `src/app/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Form, Steps, Button, Input, DatePicker, TimePicker,
  InputNumber, Select, Checkbox, Upload, message, Card, Typography, Space
} from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Dragger } = Upload
const { Title, Text } = Typography

const SYMPTOMS = [
  'ระบบเครื่องยนต์',
  'ระบบส่งกำลัง',
  'ระบบช่วงล่าง',
  'ระบบปรับอากาศ',
  'ระบบเบรค',
]

const STATUSES = [
  'ลูกค้าอนุมัติซ่อมแล้ว',
  'ซ่อมเสร็จเรียบร้อยแล้ว',
  'ส่งมอบและเก็บเงินแล้ว',
]

// Fields required per step (empty = no required fields to validate)
const STEP_REQUIRED_FIELDS: string[][] = [
  ['date', 'time'],
  ['customerName', 'phone', 'licensePlate', 'odometer'],
  [],
  ['cause', 'totalPrice', 'status'],
  [],
]

export default function IntakeFormPage() {
  const router = useRouter()
  const [form]        = Form.useForm()
  const [step, setStep]       = useState(0)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [loading, setLoading]   = useState(false)

  const goNext = async () => {
    try {
      if (STEP_REQUIRED_FIELDS[step].length > 0) {
        await form.validateFields(STEP_REQUIRED_FIELDS[step])
      }
      setStep(s => s + 1)
    } catch { /* validation error shown by Ant Design */ }
  }

  const goPrev = () => setStep(s => s - 1)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const values = form.getFieldsValue(true)

      const body = {
        date:        (values.date as dayjs.Dayjs)?.format('YYYY-MM-DD') ?? '',
        time:        (values.time as dayjs.Dayjs)?.format('HH:mm') ?? '',
        customerName: values.customerName ?? '',
        phone:        values.phone ?? '',
        licensePlate: values.licensePlate ?? '',
        odometer:     Number(values.odometer ?? 0),
        symptoms:     Array.isArray(values.symptoms) ? values.symptoms : [],
        notes:        values.notes ?? '',
        cause:        values.cause ?? '',
        totalPrice:   Number(values.totalPrice ?? 0),
        status:       values.status ?? STATUSES[0],
      }

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to save job')
      }

      const { id } = await res.json()

      // Upload images if any were selected
      if (fileList.length > 0) {
        const fd = new FormData()
        fileList.forEach(f => {
          if (f.originFileObj) fd.append('images', f.originFileObj)
        })
        const imgRes = await fetch(`/api/jobs/${id}/images`, { method: 'POST', body: fd })
        if (!imgRes.ok) {
          message.warning('บันทึกงานแล้ว แต่อัปโหลดรูปภาพไม่สำเร็จ')
        }
      }

      router.push(`/receipt/${id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const stepLabel = (n: number) =>
    ['1. เบื้องต้น','2. ลูกค้า/รถ','3. อาการ','4. ผลและราคา','5. รูปภาพ'][n]

  return (
    <div style={{ minHeight: 'calc(100vh - 48px)', background: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '32px 16px' }}>
      <Card style={{ width: '100%', maxWidth: 520, borderRadius: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.06)' }}>

        {/* Progress steps */}
        <Steps
          current={step}
          size="small"
          style={{ marginBottom: 28 }}
          items={[
            { title: 'เบื้องต้น' },
            { title: 'ลูกค้า/รถ' },
            { title: 'อาการ' },
            { title: 'ผล/ราคา' },
            { title: 'รูปภาพ' },
          ]}
        />

        <Form form={form} layout="vertical" requiredMark={false}>

          {/* ── Step 1: Basic Info ───────────────────────────── */}
          <div style={{ display: step === 0 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 20 }}>
              {stepLabel(0)}
            </Title>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="date" label="วันที่รับรถ" rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}>
                <DatePicker style={{ width: '100%' }} placeholder="เลือกวันที่" />
              </Form.Item>
              <Form.Item name="time" label="เวลา" rules={[{ required: true, message: 'กรุณาเลือกเวลา' }]}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" placeholder="เลือกเวลา" />
              </Form.Item>
            </div>
          </div>

          {/* ── Step 2: Customer & Vehicle ───────────────────── */}
          <div style={{ display: step === 1 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 20 }}>
              {stepLabel(1)}
            </Title>
            <Form.Item name="customerName" label="ชื่อ-นามสกุล ลูกค้า" rules={[{ required: true, message: 'กรุณาระบุชื่อ' }]}>
              <Input placeholder="ระบุชื่อ-นามสกุล" />
            </Form.Item>
            <Form.Item name="phone" label="เบอร์โทรศัพท์ (สำคัญมาก)" rules={[{ required: true, message: 'กรุณาระบุเบอร์โทร' }]}>
              <Input placeholder="08X-XXX-XXXX" />
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="licensePlate" label="ทะเบียนรถ" rules={[{ required: true, message: 'กรุณาระบุทะเบียน' }]}>
                <Input placeholder="กข 1234" />
              </Form.Item>
              <Form.Item name="odometer" label="เลขไมล์ (KM)" rules={[{ required: true, message: 'กรุณาระบุเลขไมล์' }]}>
                <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
              </Form.Item>
            </div>
          </div>

          {/* ── Step 3: Symptoms ─────────────────────────────── */}
          <div style={{ display: step === 2 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 20 }}>
              {stepLabel(2)}
            </Title>
            <Form.Item name="symptoms" label="เลือกระบบที่มีปัญหา">
              <Checkbox.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SYMPTOMS.map(s => (
                  <Checkbox
                    key={s}
                    value={s}
                    style={{
                      background: '#f1f5f9',
                      padding: '10px 14px',
                      borderRadius: 8,
                      marginInlineStart: 0,
                      width: '100%',
                    }}
                  >
                    {s}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </Form.Item>
            <Form.Item name="notes" label="รายละเอียดเพิ่มเติม">
              <TextArea rows={2} placeholder="อาการอื่น ๆ ที่ลูกค้าแจ้ง" />
            </Form.Item>
            <div style={{
              background: '#fff7ed',
              border: '1px dashed #f97316',
              padding: '12px 16px',
              borderRadius: 8,
              fontSize: '0.875rem',
              color: '#9a3412',
              fontStyle: 'italic',
            }}>
              <strong>ธุรการพูด:</strong> "เดี๋ยวช่างนัทจะเช็คอย่างละเอียดและโทรแจ้งราคาก่อนซ่อมนะคะ"
            </div>
          </div>

          {/* ── Step 4: Result & Price ───────────────────────── */}
          <div style={{ display: step === 3 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 20 }}>
              {stepLabel(3)}
            </Title>
            <Form.Item name="cause" label="สาเหตุที่พบ / อะไหล่" rules={[{ required: true, message: 'กรุณาระบุสาเหตุ' }]}>
              <TextArea rows={3} placeholder="เช่น ผ้าเบรคหมด, น้ำมันเครื่องรั่ว" />
            </Form.Item>
            <Form.Item name="totalPrice" label="สรุปราคาสุทธิ (บาท)" rules={[{ required: true, message: 'กรุณาระบุราคา' }]}>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="0.00" />
            </Form.Item>
            <Form.Item name="status" label="สถานะ" initialValue={STATUSES[0]} rules={[{ required: true }]}>
              <Select options={STATUSES.map(s => ({ label: s, value: s }))} />
            </Form.Item>
          </div>

          {/* ── Step 5: Image Upload ─────────────────────────── */}
          <div style={{ display: step === 4 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 20 }}>
              {stepLabel(4)}
            </Title>
            <Dragger
              accept=".jpg,.jpeg,.png,.webp"
              maxCount={10}
              fileList={fileList}
              multiple
              onChange={({ fileList: fl }) => setFileList(fl)}
              beforeUpload={() => false}
              listType="picture"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 40, color: '#2563eb' }} />
              </p>
              <p style={{ fontWeight: 600 }}>คลิกหรือลากไฟล์รูปภาพมาวางที่นี่</p>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                รองรับ JPG, PNG, WEBP · สูงสุด 10 รูป · ไม่เกิน 5 MB/รูป (ไม่บังคับ)
              </p>
            </Dragger>
          </div>
        </Form>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
          {step > 0 ? (
            <Button onClick={goPrev} disabled={loading}>กลับ</Button>
          ) : (
            <div />
          )}
          {step < 4 ? (
            <Button type="primary" onClick={goNext}>ถัดไป →</Button>
          ) : (
            <Button
              type="primary"
              style={{ background: '#10b981', borderColor: '#10b981' }}
              onClick={handleSubmit}
              loading={loading}
            >
              บันทึกงาน ✓
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: 5-step intake wizard — form, validation, image upload, submit"
```

---

## Task 11: Report page

**Files:**
- Create: `src/app/report/page.tsx`

- [ ] **Step 1: Create `src/app/report/page.tsx`**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Table, Input, Select, DatePicker, Button, Tag,
  Space, Typography, Tooltip, message
} from 'antd'
import { SearchOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { RangePickerProps } from 'antd/es/date-picker'

const { Title } = Typography
const { RangePicker } = DatePicker

const STATUSES = [
  'ลูกค้าอนุมัติซ่อมแล้ว',
  'ซ่อมเสร็จเรียบร้อยแล้ว',
  'ส่งมอบและเก็บเงินแล้ว',
]

const STATUS_COLORS: Record<string, string> = {
  'ลูกค้าอนุมัติซ่อมแล้ว':   'blue',
  'ซ่อมเสร็จเรียบร้อยแล้ว':  'orange',
  'ส่งมอบและเก็บเงินแล้ว':   'green',
}

interface JobRow {
  id: string
  jobNo: string
  date: string
  customerName: string
  licensePlate: string
  symptoms: string[]
  totalPrice: number
  status: string
}

export default function ReportPage() {
  const [data, setData]           = useState<JobRow[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(false)
  const [search, setSearch]       = useState('')
  const [status, setStatus]       = useState<string | undefined>()
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [page, setPage]           = useState(1)
  const [pageSize, setPageSize]   = useState(20)

  const buildParams = useCallback(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('pageSize', String(pageSize))
    if (search)   p.set('search', search)
    if (status)   p.set('status', status)
    if (dateFrom) p.set('dateFrom', dateFrom)
    if (dateTo)   p.set('dateTo', dateTo)
    return p
  }, [page, pageSize, search, status, dateFrom, dateTo])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/jobs?${buildParams()}`)
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      setData(json.data)
      setTotal(json.total)
    } catch {
      message.error('โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { fetchData() }, [fetchData])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, status, dateFrom, dateTo])

  const handleDateRange: RangePickerProps['onChange'] = (_, strings) => {
    setDateFrom(strings[0])
    setDateTo(strings[1])
  }

  const handleExport = () => {
    const params = buildParams()
    // Remove pagination params for full export
    params.delete('page')
    params.delete('pageSize')
    window.open(`/api/jobs/export?${params}`, '_blank')
  }

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current ?? 1)
    setPageSize(pagination.pageSize ?? 20)
  }

  const columns: ColumnsType<JobRow> = [
    {
      title: 'เลขที่ใบงาน',
      dataIndex: 'jobNo',
      key: 'jobNo',
      render: (jobNo: string, record: JobRow) => (
        <a href={`/receipt/${record.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
          {jobNo}
        </a>
      ),
    },
    { title: 'วันที่', dataIndex: 'date', key: 'date', width: 110 },
    { title: 'ชื่อลูกค้า', dataIndex: 'customerName', key: 'customerName' },
    { title: 'ทะเบียนรถ', dataIndex: 'licensePlate', key: 'licensePlate', width: 110 },
    {
      title: 'อาการ',
      dataIndex: 'symptoms',
      key: 'symptoms',
      render: (symptoms: string[]) => symptoms.join(', ') || '—',
      ellipsis: true,
    },
    {
      title: 'ราคาสุทธิ (บาท)',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      align: 'right',
      width: 130,
      render: (price: number) => price.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 200,
      render: (s: string) => <Tag color={STATUS_COLORS[s] ?? 'default'}>{s}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: unknown, record: JobRow) => (
        <Tooltip title="ดูใบงาน">
          <Button
            type="text"
            icon={<EyeOutlined />}
            href={`/receipt/${record.id}`}
            target="_blank"
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 20 }}>📋 รายงานงานซ่อม</Title>

      {/* Filter bar */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="ค้นหาชื่อลูกค้า / ทะเบียนรถ"
          style={{ width: 260 }}
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <RangePicker
          placeholder={['วันที่เริ่มต้น', 'วันที่สิ้นสุด']}
          onChange={handleDateRange}
          format="YYYY-MM-DD"
        />
        <Select
          placeholder="กรองตามสถานะ"
          allowClear
          style={{ width: 220 }}
          value={status}
          onChange={setStatus}
          options={STATUSES.map(s => ({ label: s, value: s }))}
        />
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          ส่งออก CSV
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 900 }}
        size="middle"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/report/page.tsx
git commit -m "feat: report page — table, search, date filter, status filter, CSV export"
```

---

## Task 12: Receipt page

**Files:**
- Create: `src/app/receipt/[id]/page.tsx`

- [ ] **Step 1: Create `src/app/receipt/[id]/PrintButton.tsx`** (client boundary for `window.print`)

```typescript
'use client'

import { Button } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'

export default function PrintButton() {
  return (
    <Button
      icon={<PrinterOutlined />}
      type="primary"
      onClick={() => window.print()}
    >
      พิมพ์ใบงาน
    </Button>
  )
}
```

- [ ] **Step 2: Create `src/app/receipt/[id]/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Descriptions, Tag, Image, Typography, Divider } from 'antd'
import PrintButton from './PrintButton'

const { Title, Text } = Typography

const STATUS_COLORS: Record<string, string> = {
  'ลูกค้าอนุมัติซ่อมแล้ว':  'blue',
  'ซ่อมเสร็จเรียบร้อยแล้ว': 'orange',
  'ส่งมอบและเก็บเงินแล้ว':  'green',
}

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: { images: true },
  })

  if (!job) notFound()

  const items = [
    { key: '1',  label: 'เลขที่ใบงาน',          children: <Text strong>{job.jobNo}</Text> },
    { key: '2',  label: 'วันที่รับรถ',           children: job.date },
    { key: '3',  label: 'เวลา',                  children: job.time },
    { key: '4',  label: 'ชื่อ-นามสกุล',         children: job.customerName },
    { key: '5',  label: 'เบอร์โทรศัพท์',        children: job.phone },
    { key: '6',  label: 'ทะเบียนรถ',            children: job.licensePlate },
    { key: '7',  label: 'เลขไมล์ (KM)',         children: job.odometer.toLocaleString('th-TH') },
    { key: '8',  label: 'อาการที่แจ้ง',          children: job.symptoms.length > 0 ? job.symptoms.join(', ') : '—' },
    { key: '9',  label: 'รายละเอียดเพิ่มเติม',  children: job.notes || '—' },
    { key: '10', label: 'สาเหตุ / อะไหล่',      children: job.cause },
    {
      key: '11',
      label: 'ราคาสุทธิ (บาท)',
      children: (
        <Text strong style={{ fontSize: '1.1rem', color: '#10b981' }}>
          {job.totalPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      key: '12',
      label: 'สถานะ',
      children: <Tag color={STATUS_COLORS[job.status] ?? 'default'}>{job.status}</Tag>,
    },
  ]

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>

      {/* Print button — hidden when printing via globals.css .no-print */}
      <div className="no-print" style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <PrintButton />
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>🔧 ดีดีช่างยนต์</Title>
        <Text type="secondary">ใบงานซ่อม</Text>
      </div>

      <Descriptions
        bordered
        column={2}
        items={items}
        size="small"
        labelStyle={{ fontWeight: 600, background: '#f8fafc', width: '140px' }}
      />

      {/* Images */}
      {job.images.length > 0 && (
        <>
          <Divider />
          <Title level={5}>รูปภาพประกอบ</Title>
          <Image.PreviewGroup>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {job.images.map(img => (
                <Image
                  key={img.id}
                  src={`/api/uploads/${job.id}/${img.filename}`}
                  width={120}
                  height={120}
                  style={{ objectFit: 'cover', borderRadius: 8 }}
                  alt={img.filename}
                />
              ))}
            </div>
          </Image.PreviewGroup>
        </>
      )}

      <Divider />
      <div style={{ textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: '0.8rem' }}>
          บันทึกเมื่อ {new Date(job.createdAt).toLocaleString('th-TH')}
        </Text>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/receipt/[id]/page.tsx src/app/receipt/[id]/PrintButton.tsx
git commit -m "feat: print receipt page — descriptions, image gallery, print button"
```

---

## Task 13: Add /etc/hosts entry + final smoke test

- [ ] **Step 1: Add local domain to /etc/hosts**

```bash
echo "127.0.0.1 ddreport.local" | sudo tee -a /etc/hosts
```

Expected output: `127.0.0.1 ddreport.local`

- [ ] **Step 2: Build and start Docker Compose**

```bash
cd /Users/tae/Desktop/playground/ddcar
docker compose up --build -d
```

Expected: all three services start, `app` logs `Running Prisma migrations...` then `▶ Starting Next.js...`

- [ ] **Step 3: Wait for app to be ready**

```bash
docker compose logs -f app
```

Wait until you see `Ready in` or `started server on`.  
Press `Ctrl+C` to exit the log tail.

- [ ] **Step 4: Smoke test**

Open `http://ddreport.local` in a browser. You should see the 5-step intake form with the blue nav bar.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: complete DDReport app — intake form, report, receipt, Docker production"
```

---

## Running locally (dev mode)

Start a local PostgreSQL (via Docker) and run Next.js dev server:

```bash
# Start only postgres
docker compose up postgres -d

# Run migrations
npx prisma migrate dev --name init

# Start dev server
npm run dev
```

App available at `http://localhost:3000`.

---

## Useful Docker commands

```bash
# Rebuild after code changes
docker compose up --build -d

# View logs
docker compose logs -f app

# Stop all
docker compose down

# Destroy all data (including DB and uploads)
docker compose down -v
```
