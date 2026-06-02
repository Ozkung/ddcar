# Dark Mode + SSE Real-time + Notification Bell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม Dark/Light mode toggle, SSE real-time auto-refresh หน้า Report, และ Notification Bell แบบ read/unread ใน navbar

**Architecture:** ThemeProvider (client component) ครอบ ConfigProvider ของ Ant Design อ่านจาก localStorage · SSE ใช้ Redis Pub/Sub (ioredis) ผ่าน `/api/events` endpoint — แต่ละ component สร้าง EventSource ของตัวเอง · Notification เก็บใน DB ผ่าน Prisma

**Tech Stack:** Next.js 14 App Router, Ant Design 5, ioredis 5, lucide-react, Prisma 5, PostgreSQL, Redis 7

---

## File Map

**สร้างใหม่:**
- `apps/shop/src/components/ThemeProvider.tsx` — context + ConfigProvider wrapper
- `apps/shop/src/components/ThemeToggle.tsx` — Sun/Moon button ใน nav
- `apps/shop/src/components/NotificationBell.tsx` — bell + dropdown + read/unread
- `apps/shop/src/hooks/useSSE.ts` — EventSource hook (reusable)
- `apps/shop/src/lib/redis.ts` — ioredis publisher singleton
- `apps/shop/src/app/api/events/route.ts` — SSE streaming endpoint
- `apps/shop/src/app/api/notifications/route.ts` — GET list + PATCH mark-all-read
- `apps/shop/src/app/api/notifications/[id]/read/route.ts` — PATCH mark-one-read
- `apps/shop/src/lib/__tests__/notifications.test.ts` — unit tests

**แก้ไข:**
- `apps/shop/src/app/layout.tsx` — เพิ่ม ThemeProvider, ThemeToggle, NotificationBell
- `apps/shop/src/app/report/page.tsx` — wire useSSE → fetchData
- `apps/shop/src/app/api/jobs/route.ts` — emit + create Notification หลัง POST
- `apps/shop/src/app/api/jobs/[id]/route.ts` — emit + create Notification หลัง PATCH
- `packages/db/prisma/schema.prisma` — เพิ่ม Notification model
- `docker-compose.yml` — เพิ่ม redis service
- `apps/shop/package.json` — เพิ่ม ioredis, lucide-react

---

## Task 1: Install Dependencies + Redis Service

**Files:**
- Modify: `apps/shop/package.json`
- Modify: `docker-compose.yml`

- [ ] **Step 1: เพิ่ม dependencies ใน `apps/shop/package.json`**

เปิดไฟล์ `apps/shop/package.json` แล้วเพิ่มใน `"dependencies"`:
```json
"ioredis": "^5.3.2",
"lucide-react": "^0.462.0"
```

- [ ] **Step 2: เพิ่ม Redis service ใน `docker-compose.yml`**

เพิ่ม service และ volume ดังนี้:

```yaml
services:
  postgres:
    # ... (คงเดิม)

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  app:
    build:
      context: .
      dockerfile: apps/shop/Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://ddreport:ddreport_pass@postgres:5432/ddreport
      NODE_ENV: production
      UPLOADS_DIR: /uploads
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_TRUST_HOST: "true"
      REDIS_URL: redis://redis:6379
    volumes:
      - uploads_data:/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started

  nginx:
    # ... (คงเดิม)

volumes:
  pg_data:
  uploads_data:
  redis_data:
```

- [ ] **Step 3: เพิ่ม REDIS_URL ใน `.env` สำหรับ dev**

เปิด `.env` แล้วเพิ่ม:
```
REDIS_URL=redis://localhost:6379
```

- [ ] **Step 4: Install packages**

```bash
cd /Users/tae/Desktop/playground/ddcar
pnpm install
```

Expected: ติดตั้ง ioredis และ lucide-react สำเร็จ ไม่มี error

- [ ] **Step 5: Commit**

```bash
git add apps/shop/package.json docker-compose.yml pnpm-lock.yaml .env
git commit -m "chore: add ioredis, lucide-react deps + redis service in docker-compose"
```

---

## Task 2: Prisma — Notification Model

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: เพิ่ม Notification model ใน schema**

เปิด `packages/db/prisma/schema.prisma` แล้วเพิ่มก่อน `model JobTransfer`:

```prisma
model Notification {
  id        String   @id @default(cuid())
  shopId    String
  shop      Shop     @relation(fields: [shopId], references: [id])
  type      String
  jobId     String
  job       Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  message   String
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([shopId, isRead])
  @@index([shopId, createdAt])
}
```

- [ ] **Step 2: เพิ่ม relation ใน model `Shop` และ `Job`**

ใน `model Shop` เพิ่ม:
```prisma
notifications Notification[]
```

ใน `model Job` เพิ่ม:
```prisma
notifications Notification[]
```

- [ ] **Step 3: Run migration**

```bash
cd /Users/tae/Desktop/playground/ddcar
pnpm --filter @ddcar/db exec prisma migrate dev --name add_notification
```

Expected output: `✔ Generated Prisma Client` และสร้างไฟล์ migration ใหม่

- [ ] **Step 4: Regenerate Prisma client**

```bash
pnpm db:generate
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/
git commit -m "feat: add Notification model to Prisma schema"
```

---

## Task 3: Redis Client Singleton

**Files:**
- Create: `apps/shop/src/lib/redis.ts`

- [ ] **Step 1: สร้าง Redis publisher singleton**

สร้างไฟล์ `apps/shop/src/lib/redis.ts`:

```typescript
import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redisPublisher: Redis | undefined }

export const redis =
  globalForRedis.redisPublisher ??
  new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  })

if (process.env.NODE_ENV !== 'production') globalForRedis.redisPublisher = redis
```

- [ ] **Step 2: Commit**

```bash
git add apps/shop/src/lib/redis.ts
git commit -m "feat: add Redis publisher singleton"
```

---

## Task 4: SSE Endpoint

**Files:**
- Create: `apps/shop/src/app/api/events/route.ts`

- [ ] **Step 1: สร้าง SSE streaming endpoint**

สร้างไฟล์ `apps/shop/src/app/api/events/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import Redis from 'ioredis'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { shopId } = session.user
  const channel = `shop:${shopId}`
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const subscriber = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')

      subscriber.subscribe(channel).catch(() => {
        controller.close()
        subscriber.quit()
      })

      subscriber.on('message', (_ch: string, message: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`))
        } catch {
          // controller already closed
        }
      })

      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`))
        } catch {
          clearInterval(ping)
        }
      }, 30_000)

      req.signal.addEventListener('abort', () => {
        clearInterval(ping)
        subscriber.unsubscribe(channel).finally(() => subscriber.quit())
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

- [ ] **Step 2: ทดสอบ endpoint ด้วย curl**

รัน dev server ก่อน: `pnpm dev` แล้วในอีก terminal:

```bash
curl -N -H "Cookie: <session-cookie>" http://localhost:3000/api/events
```

Expected: ได้รับ `event: ping\ndata: {}\n\n` ทุก 30 วินาที หรือ 401 ถ้าไม่ได้ login

- [ ] **Step 3: Commit**

```bash
git add apps/shop/src/app/api/events/route.ts
git commit -m "feat: add SSE /api/events endpoint with Redis subscriber"
```

---

## Task 5: useSSE Hook

**Files:**
- Create: `apps/shop/src/hooks/useSSE.ts`

- [ ] **Step 1: สร้าง useSSE hook**

สร้างโฟลเดอร์และไฟล์ `apps/shop/src/hooks/useSSE.ts`:

```typescript
'use client'
import { useEffect, useRef } from 'react'

export type SSEEvent =
  | { type: 'job_created'; jobId: string; jobNo: string; shopId: string }
  | { type: 'job_status_changed'; jobId: string; jobNo: string; status: string; shopId: string }

export function useSSE(onEvent: (event: SSEEvent) => void) {
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    const es = new EventSource('/api/events')

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as SSEEvent
        handlerRef.current(data)
      } catch {
        // ignore ping or malformed
      }
    }

    return () => es.close()
  }, [])
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/shop/src/hooks/useSSE.ts
git commit -m "feat: add useSSE hook for EventSource subscription"
```

---

## Task 6: Emit Events from POST /api/jobs

**Files:**
- Modify: `apps/shop/src/app/api/jobs/route.ts`

- [ ] **Step 1: เพิ่ม import redis และ emit หลัง job create**

เปิด `apps/shop/src/app/api/jobs/route.ts` แล้วเพิ่ม import บนสุด:

```typescript
import { redis } from '@/lib/redis'
```

แล้วแก้ส่วน return ของ POST — เพิ่มหลัง `const job = await prisma.$transaction(...)` และก่อน `return NextResponse.json(...)`:

```typescript
    // Emit SSE event + create notification (non-blocking)
    const ssePayload = JSON.stringify({
      type: 'job_created',
      jobId: job.id,
      jobNo: job.jobNo,
      shopId,
    })
    Promise.all([
      redis.publish(`shop:${shopId}`, ssePayload),
      prisma.notification.create({
        data: {
          shopId,
          type: 'job_created',
          jobId: job.id,
          message: `งานใหม่ ${job.jobNo} · ${String(licensePlate)}`,
        },
      }),
    ]).catch((err) => console.error('[SSE emit job_created]', err))

    return NextResponse.json({ id: job.id, jobNo: job.jobNo }, { status: 201 })
```

- [ ] **Step 2: ทดสอบ — สร้างงานใหม่แล้วดู SSE stream**

เปิด 2 terminal:
1. `curl -N http://localhost:3000/api/events` (ต้อง login ก่อน)
2. สร้างงานใหม่ผ่านหน้า UI

Expected: terminal 1 ได้รับ `data: {"type":"job_created","jobId":"...","jobNo":"...","shopId":"..."}`

- [ ] **Step 3: Commit**

```bash
git add apps/shop/src/app/api/jobs/route.ts
git commit -m "feat: emit job_created SSE event and create Notification on POST /api/jobs"
```

---

## Task 7: Emit Events from PATCH /api/jobs/[id]

**Files:**
- Modify: `apps/shop/src/app/api/jobs/[id]/route.ts`

- [ ] **Step 1: เพิ่ม import redis**

เปิด `apps/shop/src/app/api/jobs/[id]/route.ts` แล้วเพิ่ม import บนสุด:

```typescript
import { redis } from '@/lib/redis'
```

- [ ] **Step 2: เพิ่ม emit หลัง transaction สำเร็จ**

หาบรรทัด `return NextResponse.json(updated)` ที่ท้าย PATCH handler แล้วเพิ่มก่อน return:

```typescript
    // Emit SSE when status changed
    if (newStatus && newStatus !== existing.status) {
      const owningShopId = existing.shopId ?? shopId
      const ssePayload = JSON.stringify({
        type: 'job_status_changed',
        jobId: params.id,
        jobNo: existing.jobNo,
        status: newStatus,
        shopId: owningShopId,
      })
      Promise.all([
        redis.publish(`shop:${owningShopId}`, ssePayload),
        prisma.notification.create({
          data: {
            shopId: owningShopId,
            type: 'job_status_changed',
            jobId: params.id,
            message: `สถานะเปลี่ยน ${existing.jobNo} → ${newStatus}`,
          },
        }),
      ]).catch((err) => console.error('[SSE emit job_status_changed]', err))
    }

    return NextResponse.json(updated)
```

- [ ] **Step 3: ทดสอบ — เปลี่ยนสถานะงานแล้วดู SSE stream**

เปิด SSE stream ใน terminal แล้วเปลี่ยนสถานะงานจากหน้า Report

Expected: ได้รับ `data: {"type":"job_status_changed","jobId":"...","jobNo":"...","status":"...","shopId":"..."}`

- [ ] **Step 4: Commit**

```bash
git add apps/shop/src/app/api/jobs/[id]/route.ts
git commit -m "feat: emit job_status_changed SSE event and create Notification on PATCH /api/jobs/[id]"
```

---

## Task 8: Report Page — Wire useSSE

**Files:**
- Modify: `apps/shop/src/app/report/page.tsx`

- [ ] **Step 1: เพิ่ม import useSSE**

เปิด `apps/shop/src/app/report/page.tsx` แล้วเพิ่ม import:

```typescript
import { useSSE } from '@/hooks/useSSE'
```

- [ ] **Step 2: เพิ่ม useSSE call ภายใน component `ReportPage`**

เพิ่มหลัง `const handleStatusChange = ...` (ประมาณบรรทัด 125):

```typescript
  useSSE((event) => {
    if (event.type === 'job_created' || event.type === 'job_status_changed') {
      fetchData()
    }
  })
```

- [ ] **Step 3: ทดสอบ**

เปิดหน้า Report ในหน้าต่างหนึ่ง แล้วสร้างงานใหม่จากอีกหน้าต่าง

Expected: หน้า Report อัปเดตตารางอัตโนมัติภายใน 1-2 วินาทีโดยไม่ต้อง reload

- [ ] **Step 4: Commit**

```bash
git add apps/shop/src/app/report/page.tsx
git commit -m "feat: auto-refresh report table via SSE events"
```

---

## Task 9: Notification API Routes

**Files:**
- Create: `apps/shop/src/app/api/notifications/route.ts`
- Create: `apps/shop/src/app/api/notifications/[id]/read/route.ts`
- Create: `apps/shop/src/lib/__tests__/notifications.test.ts`

- [ ] **Step 1: เขียน failing tests ก่อน**

สร้างไฟล์ `apps/shop/src/lib/__tests__/notifications.test.ts`:

```typescript
import { buildNotificationMessage } from '@/lib/notificationUtils'

describe('buildNotificationMessage', () => {
  it('formats job_created message', () => {
    const msg = buildNotificationMessage('job_created', 'JB-001', 'กข-1234')
    expect(msg).toBe('งานใหม่ JB-001 · กข-1234')
  })

  it('formats job_status_changed message', () => {
    const msg = buildNotificationMessage('job_status_changed', 'JB-001', undefined, 'ซ่อมเสร็จแล้ว')
    expect(msg).toBe('สถานะเปลี่ยน JB-001 → ซ่อมเสร็จแล้ว')
  })
})
```

- [ ] **Step 2: รัน test ให้ fail ก่อน**

```bash
cd apps/shop && pnpm test
```

Expected: FAIL — `Cannot find module '@/lib/notificationUtils'`

- [ ] **Step 3: สร้าง utility function**

สร้างไฟล์ `apps/shop/src/lib/notificationUtils.ts`:

```typescript
export function buildNotificationMessage(
  type: string,
  jobNo: string,
  licensePlate?: string,
  status?: string,
): string {
  if (type === 'job_created') {
    return `งานใหม่ ${jobNo} · ${licensePlate ?? ''}`
  }
  return `สถานะเปลี่ยน ${jobNo} → ${status ?? ''}`
}
```

- [ ] **Step 4: รัน test ให้ pass**

```bash
cd apps/shop && pnpm test
```

Expected: PASS — 2 tests pass

- [ ] **Step 5: สร้าง GET + PATCH /api/notifications**

สร้างไฟล์ `apps/shop/src/app/api/notifications/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId } = session.user

  const limit = Math.min(50, Number(req.nextUrl.searchParams.get('limit') ?? '10'))

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({ where: { shopId, isRead: false } }),
  ])

  return NextResponse.json({ items, unreadCount })
}

export async function PATCH(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId } = session.user

  await prisma.notification.updateMany({
    where: { shopId, isRead: false },
    data: { isRead: true },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: สร้าง PATCH /api/notifications/[id]/read**

สร้างไฟล์ `apps/shop/src/app/api/notifications/[id]/read/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId } = session.user

  await prisma.notification.updateMany({
    where: { id: params.id, shopId },
    data: { isRead: true },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: อัปเดต import ใน job routes ให้ใช้ `buildNotificationMessage`**

เปิด `apps/shop/src/app/api/jobs/route.ts` แล้วเพิ่ม import:
```typescript
import { buildNotificationMessage } from '@/lib/notificationUtils'
```

แล้วแก้ `message` ใน `prisma.notification.create`:
```typescript
message: buildNotificationMessage('job_created', job.jobNo, String(licensePlate)),
```

เปิด `apps/shop/src/app/api/jobs/[id]/route.ts` แล้วเพิ่ม import:
```typescript
import { buildNotificationMessage } from '@/lib/notificationUtils'
```

แล้วแก้ `message` ใน `prisma.notification.create`:
```typescript
message: buildNotificationMessage('job_status_changed', existing.jobNo, undefined, newStatus),
```

- [ ] **Step 8: Commit**

```bash
git add apps/shop/src/app/api/notifications/ \
        apps/shop/src/lib/notificationUtils.ts \
        apps/shop/src/lib/__tests__/notifications.test.ts \
        apps/shop/src/app/api/jobs/route.ts \
        apps/shop/src/app/api/jobs/[id]/route.ts
git commit -m "feat: notification API routes (GET list, PATCH read) + buildNotificationMessage util"
```

---

## Task 10: NotificationBell Component

**Files:**
- Create: `apps/shop/src/components/NotificationBell.tsx`

- [ ] **Step 1: สร้าง NotificationBell component**

สร้างโฟลเดอร์ `apps/shop/src/components/` แล้วสร้างไฟล์ `NotificationBell.tsx`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge, Dropdown, Button, Typography } from 'antd'
import { Bell, FileText, RefreshCw } from 'lucide-react'
import { useSSE } from '@/hooks/useSSE'

interface NotificationItem {
  id: string
  type: string
  message: string
  isRead: boolean
  createdAt: string
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'เมื่อกี้'
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`
  return `${Math.floor(diff / 86400)} วันที่แล้ว`
}

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=10')
      if (!res.ok) return
      const data = await res.json()
      setItems(data.items)
      setUnreadCount(data.unreadCount)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  useSSE((event) => {
    if (event.type === 'job_created' || event.type === 'job_status_changed') {
      fetchNotifications()
    }
  })

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' })
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  const markOneRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const dropdownContent = (
    <div style={{ width: 280, background: 'white', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Text strong>การแจ้งเตือน</Typography.Text>
        {unreadCount > 0 && (
          <Button type="link" size="small" style={{ padding: 0, fontSize: 11 }} onClick={markAllRead}>
            อ่านทั้งหมด
          </Button>
        )}
      </div>

      {items.length === 0 && (
        <div style={{ padding: '16px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
          ไม่มีการแจ้งเตือน
        </div>
      )}

      {items.map(n => (
        <div
          key={n.id}
          onClick={() => !n.isRead && markOneRead(n.id)}
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid #f1f5f9',
            background: n.isRead ? 'white' : '#eff6ff',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            cursor: n.isRead ? 'default' : 'pointer',
            opacity: n.isRead ? 0.55 : 1,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: n.isRead ? '#cbd5e1' : '#2563eb', marginTop: 5, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: n.isRead ? 400 : 600, color: n.isRead ? '#475569' : '#1e293b' }}>
              {n.type === 'job_created'
                ? <FileText size={11} />
                : <RefreshCw size={11} />
              }
              {n.message}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{timeAgo(n.createdAt)}</div>
          </div>
        </div>
      ))}

      <div style={{ padding: '6px 12px', textAlign: 'center' }}>
        <Button type="link" size="small" style={{ fontSize: 11 }} href="/report">
          ดูทั้งหมดในรายงาน
        </Button>
      </div>
    </div>
  )

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<Bell size={16} />}
          style={{ color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center' }}
        />
      </Badge>
    </Dropdown>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/shop/src/components/NotificationBell.tsx
git commit -m "feat: NotificationBell component with read/unread states"
```

---

## Task 11: Dark Mode — ThemeProvider + ThemeToggle

**Files:**
- Create: `apps/shop/src/components/ThemeProvider.tsx`
- Create: `apps/shop/src/components/ThemeToggle.tsx`

- [ ] **Step 1: สร้าง ThemeProvider**

สร้างไฟล์ `apps/shop/src/components/ThemeProvider.tsx`:

```typescript
'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ConfigProvider, theme as antTheme } from 'antd'
import thTH from 'antd/locale/th_TH'

interface ThemeContextValue {
  isDark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ isDark: false, toggle: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('ddcar-theme') === 'dark') setIsDark(true)
  }, [])

  const toggle = useCallback(() => {
    setIsDark(prev => {
      const next = !prev
      localStorage.setItem('ddcar-theme', next ? 'dark' : 'light')
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      <ConfigProvider
        locale={thTH}
        theme={{
          algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token: { fontFamily: 'Sarabun, sans-serif' },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
```

- [ ] **Step 2: สร้าง ThemeToggle**

สร้างไฟล์ `apps/shop/src/components/ThemeToggle.tsx`:

```typescript
'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { isDark, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'เปลี่ยนเป็น Light Mode' : 'เปลี่ยนเป็น Dark Mode'}
      style={{
        background: 'rgba(255,255,255,0.15)',
        border: 'none',
        borderRadius: 20,
        padding: '4px 10px',
        cursor: 'pointer',
        color: 'rgba(255,255,255,0.85)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/shop/src/components/ThemeProvider.tsx apps/shop/src/components/ThemeToggle.tsx
git commit -m "feat: ThemeProvider (Ant Design dark/light) + ThemeToggle button"
```

---

## Task 12: Wire Everything into layout.tsx

**Files:**
- Modify: `apps/shop/src/app/layout.tsx`

- [ ] **Step 1: อัปเดต layout.tsx**

แทนที่ไฟล์ `apps/shop/src/app/layout.tsx` ทั้งหมดด้วย:

```typescript
import type { Metadata } from 'next'
import { Sarabun } from 'next/font/google'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import Link from 'next/link'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'
import { UserNav } from './UserNav'
import { prisma } from '@/lib/prisma'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'
import { NotificationBell } from '@/components/NotificationBell'
import './globals.css'

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ดีดีช่างยนต์',
  description: 'ระบบจัดการงานซ่อมรถยนต์',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'DDReport' },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  other: { 'mobile-web-app-capable': 'yes' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const user = session?.user

  let pendingTransferCount = 0
  if (user && user.role !== 'TECH') {
    pendingTransferCount = await prisma.jobTransfer.count({
      where: { toShopId: user.shopId, status: 'PENDING' },
    })
  }

  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('ddcar-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark')})()`,
          }}
        />
      </head>
      <body className={sarabun.className}>
        <SessionProvider>
          <AntdRegistry>
            <ThemeProvider>
              {user && (
                <nav
                  style={{
                    background: '#2563eb',
                    padding: '0.75rem 1.5rem',
                    display: 'flex',
                    gap: '1.5rem',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>
                    ดีดีช่างยนต์
                  </span>
                  <Link href="/" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                    รับรถเข้าซ่อม
                  </Link>
                  <Link href="/report" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                    รายงาน
                  </Link>
                  {(user.role === 'SUPER_ADMIN' || user.role === 'SHOP_ADMIN' || user.role === 'LEAD_TECH') && (
                    <Link href="/analytics" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                      วิเคราะห์ข้อมูล
                    </Link>
                  )}
                  {(user.role === 'SUPER_ADMIN' || user.role === 'SHOP_ADMIN' || user.role === 'LEAD_TECH') && (
                    <Link href="/stock" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                      คลังอะไหล่
                    </Link>
                  )}
                  {(user.role === 'SUPER_ADMIN' || user.role === 'SHOP_ADMIN' || user.role === 'LEAD_TECH') && (
                    <Link href="/jobs/incoming" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', position: 'relative' }}>
                      งานที่รับโอน
                      {pendingTransferCount > 0 && (
                        <span style={{
                          position: 'absolute',
                          top: -8,
                          right: -12,
                          background: '#ef4444',
                          color: 'white',
                          borderRadius: '50%',
                          fontSize: 10,
                          fontWeight: 700,
                          minWidth: 16,
                          height: 16,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 3px',
                        }}>
                          {pendingTransferCount}
                        </span>
                      )}
                    </Link>
                  )}
                  {(user.role === 'SUPER_ADMIN' || user.role === 'SHOP_ADMIN') && (
                    <Link href="/admin/users" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                      จัดการผู้ใช้
                    </Link>
                  )}
                  {(user.role === 'SUPER_ADMIN' || user.role === 'SHOP_ADMIN') && (
                    <Link href="/admin/partners" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                      จัดการพันธมิตร
                    </Link>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ThemeToggle />
                    <NotificationBell />
                    <UserNav name={user.name!} role={user.role} shopName={user.shopName} />
                  </div>
                </nav>
              )}
              {children}
              <footer style={{ textAlign: 'center', padding: '1.5rem', fontSize: 12, color: '#94a3b8' }}>
                <Link href="/privacy" style={{ color: '#94a3b8', marginRight: 16 }}>Privacy Policy</Link>
                <Link href="/terms" style={{ color: '#94a3b8' }}>Terms of Service</Link>
              </footer>
            </ThemeProvider>
          </AntdRegistry>
        </SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: ทดสอบ full flow**

1. รัน `pnpm dev`
2. Login เข้าระบบ
3. ตรวจสอบ navbar: เห็น Moon icon (toggle) + Bell icon
4. กด toggle: หน้าเปลี่ยนเป็น dark mode
5. Refresh หน้า: dark mode ยังคงอยู่
6. เปิดหน้า Report, สร้างงานใหม่ — ตารางอัปเดตอัตโนมัติ
7. Bell badge แสดงตัวเลข, กดดู dropdown แสดง notification

- [ ] **Step 3: Commit**

```bash
git add apps/shop/src/app/layout.tsx
git commit -m "feat: wire ThemeProvider, ThemeToggle, NotificationBell into root layout"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run all tests**

```bash
cd /Users/tae/Desktop/playground/ddcar
pnpm test
```

Expected:
```
@ddcar/shop:test: PASS src/lib/__tests__/refCode.test.ts
@ddcar/shop:test: PASS src/lib/__tests__/jobNo.test.ts
@ddcar/shop:test: PASS src/lib/__tests__/notifications.test.ts
@ddcar/shop:test: Tests: 10 passed, 10 total
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/shop && npx tsc --noEmit 2>&1 | head -20
```

Expected: ไม่มี output (zero errors)

- [ ] **Step 3: ทดสอบ dark mode persistence**

1. เปิด browser → login
2. กด toggle → dark mode
3. ปิดแล้วเปิด browser ใหม่ → ยัง dark อยู่
4. กด toggle อีกครั้ง → light mode

- [ ] **Step 4: ทดสอบ SSE + Notification Bell**

1. เปิด 2 browser tabs (login เดียวกัน)
2. Tab 1: หน้า Report
3. Tab 2: สร้างงานใหม่ → submit
4. Tab 1: ตาราง refresh อัตโนมัติ + Bell badge เพิ่ม 1
5. กด Bell → เห็น notification ใหม่ (unread สีน้ำเงิน)
6. กด "อ่านทั้งหมด" → ทุกรายการเปลี่ยนเป็นสีจาง, badge หายไป

- [ ] **Step 5: Final commit**

```bash
git add -A
git status  # verify no unexpected files
git commit -m "feat: complete dark mode + SSE real-time + notification bell (Phase 2)"
```
