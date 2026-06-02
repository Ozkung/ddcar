# Dark Mode + SSE Real-time + Notification Bell — Design Spec

**Date:** 2026-06-02
**Branch:** feature/phase-3a-monorepo (ต่อจาก Phase 3A)
**Scope:** 3 features ที่ implement พร้อมกัน + อัปเดต infra/subscription decisions

---

## 1. Dark Mode / Light Mode

### 1.1 Architecture

`ThemeProvider` — client component ครอบ `ConfigProvider` ของ Ant Design ที่ `apps/shop/src/app/layout.tsx`

```
layout.tsx (server)
  └─ ThemeProvider (client) ← อ่าน/เขียน localStorage
       └─ ConfigProvider (Ant Design) ← theme.darkAlgorithm / defaultAlgorithm
            └─ {children}
```

### 1.2 Files

| File | Action |
|------|--------|
| `apps/shop/src/components/ThemeProvider.tsx` | สร้างใหม่ — context + localStorage |
| `apps/shop/src/app/layout.tsx` | ครอบด้วย ThemeProvider, ลบ inline ConfigProvider ออก |
| `apps/shop/src/app/UserNav.tsx` | เพิ่ม toggle button (Sun/Moon icon) ใน navbar |

### 1.3 ThemeProvider Contract

```typescript
// context value
interface ThemeContextValue {
  isDark: boolean
  toggle: () => void
}
```

- อ่านจาก `localStorage.getItem('ddcar-theme')` → `'dark'` | `'light'` | null
- Default: `'light'`
- เปลี่ยนค่า → เขียน localStorage + update state → ConfigProvider re-render ด้วย algorithm ใหม่

### 1.4 Toggle UI

- ตำแหน่ง: Navbar ขวาสุด ก่อน UserNav button
- Icon: Lucide `Sun` (light mode) / `Moon` (dark mode)
- Style: `background: rgba(255,255,255,0.15); border-radius: 20px; padding: 3px 8px`
- ไม่มี label — icon อย่างเดียว

### 1.5 Hydration

ใส่ `suppressHydrationWarning` บน `<html>` tag และ init script ใน `<head>` เพื่อ set class ก่อน hydrate (ป้องกัน flash):

```html
<script>
  (function(){
    var t = localStorage.getItem('ddcar-theme');
    if(t === 'dark') document.documentElement.setAttribute('data-theme','dark');
  })()
</script>
```

---

## 2. SSE Real-time (Phase 2)

### 2.1 Architecture

```
Mutation (POST/PATCH /api/jobs/*)
  ├─ บันทึก Notification record ใน DB
  └─ Redis PUBLISH shop:{shopId} {event JSON}
       └─ GET /api/events (ReadableStream)
            ├─ subscribe Redis channel shop:{shopId}
            └─ stream SSE → Browser EventSource
                 ├─ Report page: auto-refresh table
                 └─ NotificationBell: update unread count
```

### 2.2 Redis Setup (docker-compose.yml)

เพิ่ม service:
```yaml
redis:
  image: redis:7-alpine
  restart: unless-stopped
  volumes:
    - redis_data:/data
```

env var: `REDIS_URL=redis://redis:6379`

เมื่อ migrate ไป AWS: เปลี่ยน `REDIS_URL` เป็น ElastiCache endpoint เท่านั้น ไม่ต้องแก้โค้ด

### 2.3 Files

| File | Action |
|------|--------|
| `apps/shop/src/lib/redis.ts` | singleton ioredis client |
| `apps/shop/src/app/api/events/route.ts` | GET — ReadableStream SSE endpoint |
| `apps/shop/src/app/api/jobs/route.ts` | แก้ POST — emit หลัง create |
| `apps/shop/src/app/api/jobs/[id]/route.ts` | แก้ PATCH — emit หลัง update |
| `apps/shop/src/hooks/useSSE.ts` | client hook — EventSource lifecycle |
| `packages/db/prisma/schema.prisma` | เพิ่ม Notification model |

### 2.4 SSE Endpoint

```
GET /api/events
Headers: Accept: text/event-stream
Auth: session required (shopId จาก session)
```

- Subscribe Redis channel `shop:{shopId}`
- Keep-alive: ส่ง `event: ping\ndata: {}\n\n` ทุก 30s
- ALB idle timeout: ต้องตั้ง ≥ 300s (เมื่อ migrate ไป AWS)
- EventSource reconnect อัตโนมัติ (browser built-in)

### 2.5 Event Payload

```typescript
type SSEEvent =
  | { type: 'job_created';        jobId: string; jobNo: string; shopId: string }
  | { type: 'job_status_changed'; jobId: string; jobNo: string; status: string; shopId: string }
```

### 2.6 Report Page Auto-refresh

`apps/shop/src/app/report/page.tsx`:
- เพิ่ม `useSSE` hook
- รับ `job_created` / `job_status_changed` → call `fetchJobs()` ที่มีอยู่แล้ว
- ไม่มี banner ไม่มี toast — refresh เงียบ ๆ

### 2.7 Notification DB Schema

```prisma
model Notification {
  id        String   @id @default(cuid())
  shopId    String
  shop      Shop     @relation(fields: [shopId], references: [id])
  type      String   // 'job_created' | 'job_status_changed'
  jobId     String
  job       Job      @relation(fields: [jobId], references: [id])
  message   String   // "งานใหม่ JB-045 · กข-1234" / "สถานะเปลี่ยน JB-043 → ซ่อมเสร็จ"
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([shopId, isRead])
  @@index([shopId, createdAt])
}
```

---

## 3. Notification Bell

### 3.1 UI — Compact List Style

```
Navbar
  └─ [Bell icon + badge count]  ← เปิด Dropdown
       └─ Dropdown (Ant Design)
            ├─ Header: "การแจ้งเตือน" + ปุ่ม "อ่านทั้งหมด"
            ├─ [unread] พื้นหลัง #eff6ff + จุดน้ำเงิน + icon FileText/RefreshCw
            ├─ [unread] ...
            ├─ [read]   opacity 0.5 + จุดเทา
            └─ Footer: "ดูทั้งหมด"
```

- Badge: แสดง unread count สีแดง ซ่อนเมื่อ count = 0
- Icon: Lucide `Bell` (navbar), `FileText` (job_created), `RefreshCw` (job_status_changed)
- Max แสดงใน dropdown: 10 รายการล่าสุด

### 3.2 Files

| File | Action |
|------|--------|
| `apps/shop/src/components/NotificationBell.tsx` | client component ทั้งหมด |
| `apps/shop/src/app/api/notifications/route.ts` | GET — list, PATCH — mark read |
| `apps/shop/src/app/layout.tsx` | เพิ่ม NotificationBell ใน nav |

### 3.3 Notification API

```
GET  /api/notifications?limit=10    → { items: Notification[], unreadCount: number }
PATCH /api/notifications/read        → mark all isRead=true สำหรับ shopId
PATCH /api/notifications/[id]/read   → mark single isRead=true
```

### 3.4 useSSE Hook + NotificationBell Integration

เมื่อรับ SSE event:
1. `fetchUnreadCount()` — อัปเดต badge
2. ถ้า dropdown เปิดอยู่ → `fetchNotifications()` ด้วย

---

## 4. Infrastructure Decisions

### 4.1 ปัจจุบัน — Lightsail $10/month

```yaml
# docker-compose.yml additions
redis:
  image: redis:7-alpine
  restart: unless-stopped
  volumes:
    - redis_data:/data

# ENV additions
REDIS_URL: redis://redis:6379
```

ไม่ต้องแก้อะไรอื่น — Redis container เพิ่มใหม่ใน compose stack

### 4.2 Migration Path

| Phase | Trigger | Infra | ค่าใช้จ่าย |
|-------|---------|-------|-----------|
| ตอนนี้ | — | Lightsail $10 + Docker Compose | $10/mo |
| Phase 1 | RAM > 80% หรือ 3+ shops | Lightsail upgrade $20 (กดปุ่มเดียว) | $20/mo |
| Phase 2 | 20+ shops | EC2 t3.small + RDS t4g.micro + ElastiCache + S3 | ~$65/mo |
| Phase 3 | 30+ shops | ECS Fargate 2 tasks + ALB + RDS Multi-AZ + CloudFront | ~$187/mo |

**SSE + Redis:** ทำงานได้ทุก phase — แก้แค่ `REDIS_URL` env var เมื่อ migrate ไป ElastiCache

**S3 uploads:** ยังใช้ local volume บน Lightsail ก่อน migrate พร้อม Phase 2

---

## 5. Subscription Pricing Update

### 5.1 เหตุผลที่ปรับ

- ราคาเดิม Pro ฿1,000/mo: break-even ต้องมี 3 shops (ไม่รวม support cost)
- Trial 30 วัน: แต่ละ trial shop = −$10 infra cost ช่วงนั้น

### 5.2 Tiers ใหม่

| Plan | ราคา | Users | อะไหล่ | สาขา | พันธมิตร | Analytics |
|------|------|-------|--------|------|---------|-----------|
| Free Trial | ฟรี 14 วัน | 2 | 5 | 1 | — | — |
| Basic | ฿590/mo | 3 | 20 | 1 | 2 | — |
| **Pro** ⭐ | ฿1,490/mo | 10 | 100 | 5 | 10 | ✓ |
| Business | ฿3,490/mo | ∞ | ∞ | ∞ | ∞ | ✓ + API |

Add-on อะไหล่: Basic/Pro +฿99 / 10 ชิ้น / เดือน

### 5.3 Break-even

- Lightsail $10 (~฿365): break-even ที่ Basic 1 shop (฿560 net หลัก Stripe)
- AWS Phase 2 (~฿2,400): break-even ที่ Pro 2 shops (฿2,862 net)
- AWS Phase 3 (~฿6,800): break-even ที่ Pro 5 shops (฿7,155 net)

### 5.4 Schema Changes

เปลี่ยน enum `Plan`:
```prisma
enum Plan {
  TRIAL
  BASIC      // ใหม่
  PRO
  BUSINESS   // เปลี่ยนจาก ENTERPRISE
}
```

`PlanLimit` table อัปเดต values ตาม tier ใหม่

---

## 6. Dependencies เพิ่ม

```json
// apps/shop/package.json
"ioredis": "^5.3.2",
"lucide-react": "^0.400.0"
```

`ioredis` — Redis client สำหรับ SSE pub/sub
`lucide-react` — icons (Sun, Moon, Bell, FileText, RefreshCw)

---

## 7. Scope ที่ไม่รวม

- VoIP (Phase 4)
- Chat (Phase 3)
- Admin Portal (Phase 3B)
- Stripe integration (เป็น separate plan)
- S3 migration (ทำใน Phase 2 infra migration)
- CloudFront / ALB setup (ทำใน Phase 3 infra)
