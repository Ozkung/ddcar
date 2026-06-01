# Phase 3: SaaS Platform — Design Spec

**Goal:** เปลี่ยน ddcar จาก single-tenant app เป็น SaaS platform ที่ร้านซ่อมรถสมัครใช้งานเองได้ พร้อม subscription billing และ platform admin portal แยกต่างหาก

**Architecture:** Monorepo (pnpm workspaces + Turborepo) แยกเป็น `apps/shop` (ปัจจุบัน) + `apps/admin-portal` (ใหม่) + `packages/db` (shared Prisma schema). Stripe สำหรับ billing. Subscription status ตรวจใน middleware ทุก request (lazy evaluation — ไม่ใช้ cron)

**Tech Stack:** Next.js 14 App Router, Prisma (PostgreSQL), Ant Design 5 (light/dark mode), Auth.js v5, Stripe

---

## 1. Monorepo Structure

```
ddcar/
├── apps/
│   ├── shop/            ← ddcar ปัจจุบัน (ย้ายจาก root)
│   └── admin-portal/    ← Platform Admin app (ใหม่)
├── packages/
│   └── db/              ← shared Prisma schema + generated client
│       ├── prisma/
│       │   └── schema.prisma
│       └── index.ts
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

ทั้ง 2 apps import Prisma จาก `@ddcar/db`:
```typescript
import { prisma } from '@ddcar/db'
```

แต่ละ app มี `.env` และ `Dockerfile` ของตัวเอง. `docker-compose.yml` ที่ root รัน 2 apps พร้อมกันบน port ต่างกัน

---

## 2. Plans & Limits

### 2.1 Pricing Tiers

| | Free Trial | Pro | Enterprise |
|---|---|---|---|
| ราคา | ฟรี 30 วัน | 1,000฿/เดือน | Contact sales |
| Users | 3 | 10 | ∞ |
| ใบงาน | ∞ | ∞ | ∞ |
| อะไหล่ | 10 ชิ้น | 30 ชิ้น | ∞ |
| พันธมิตร | 2 ร้าน | 10 ร้าน | ∞ |
| สาขา | 1 | 10 | ∞ |
| Add-on อะไหล่ | +$1/10ชิ้น/เดือน | +$1/10ชิ้น/เดือน | — |

### 2.2 Database Schema — ใหม่

```prisma
enum Plan {
  TRIAL
  PRO
  ENTERPRISE
}

enum SubStatus {
  TRIALING   // ใช้งานอยู่ใน 30 วัน
  ACTIVE     // จ่ายแล้ว ปกติ
  GRACE      // หมดแล้วยังไม่จ่าย (7 วัน)
  PAST_DUE   // จ่ายไม่ผ่าน (7 วัน)
  LOCKED     // พ้น grace แล้ว ใช้ไม่ได้
  CANCELLED  // ยกเลิกเอง
}

model Subscription {
  id                   String    @id @default(cuid())
  shopId               String    @unique
  shop                 Shop      @relation(fields: [shopId], references: [id])
  plan                 Plan      @default(TRIAL)
  status               SubStatus @default(TRIALING)
  stripeCustomerId     String?   @unique
  stripeSubscriptionId String?   @unique
  trialEndsAt          DateTime
  graceEndsAt          DateTime?
  currentPeriodEnd     DateTime?
  addonItems           Int       @default(0)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
}

model PlanLimit {
  id         String   @id @default(cuid())
  plan       Plan     @unique
  users      Int
  stockItems Int
  partners   Int
  branches   Int
  updatedAt  DateTime @updatedAt
}
```

เพิ่มใน `model Shop`:
```prisma
subscription Subscription?
```

เพิ่มใน `model User`:
```prisma
lastActivityAt DateTime?
```

### 2.3 Seed ค่าเริ่มต้น PlanLimit

```typescript
await prisma.planLimit.createMany({
  data: [
    { plan: 'TRIAL',      users: 3,       stockItems: 10, partners: 2,  branches: 1  },
    { plan: 'PRO',        users: 10,      stockItems: 30, partners: 10, branches: 10 },
    { plan: 'ENTERPRISE', users: 9999999, stockItems: 9999999, partners: 9999999, branches: 9999999 }, // 9999999 = effectively unlimited
  ]
})
```

### 2.4 Limit Enforcement

`packages/db/src/planLimits.ts` — helper function ใช้ร่วมกันทั้ง 2 apps:

```typescript
export async function checkLimit(shopId: string, resource: 'users' | 'stockItems' | 'partners' | 'branches') {
  const sub = await prisma.subscription.findUnique({ where: { shopId } })
  const limit = await getPlanLimit(sub.plan)  // cached 5 นาที
  const effectiveLimit = resource === 'stockItems'
    ? limit.stockItems + (sub.addonItems ?? 0)
    : limit[resource]
  const count = await countResource(shopId, resource)
  if (count >= effectiveLimit) {
    throw Object.assign(new Error('ถึง limit กรุณา upgrade'), { status: 402 })
  }
}
```

Cache ด้วย `unstable_cache` TTL 300 วินาที เพราะ PlanLimit เปลี่ยนไม่บ่อย

Routes ที่ต้องเพิ่ม limit check:

| Route | Resource |
|---|---|
| POST /api/admin/users | users |
| POST /api/admin/shops | branches |
| POST /api/admin/partners | partners |
| POST /api/stock | stockItems |

---

## 3. Self-signup + Stripe Integration

### 3.1 Self-signup Flow

หน้า `/signup` (public) — ไม่ต้อง login:

```
กรอกข้อมูล
→ สร้าง Shop + User(SHOP_ADMIN) + Subscription(TRIALING) ใน 1 transaction
→ สร้าง Stripe Customer ใน background
→ auto-login
→ redirect → /
```

ฟิลด์ในฟอร์ม: ชื่อร้าน, ชื่อเจ้าของ, Email, Password, RefCode (auto-generate แก้ได้)

### 3.2 Subscription Lifecycle

```
Signup ────────────→ TRIALING (30 วัน)
                          │ ไม่ upgrade
                          ↓
                      GRACE (7 วัน) ──→ LOCKED
                          │ จ่าย
                          ↓
Upgrade ───────────→ ACTIVE ──→ ต่ออายุอัตโนมัติ Stripe
                          │ จ่ายไม่ผ่าน
                          ↓
                      PAST_DUE (7 วัน) ──→ LOCKED
```

ตรวจสถานะใน **Auth Middleware** ทุก request (lazy evaluation):
- `TRIALING` + `now > trialEndsAt` → SET GRACE, `graceEndsAt = now+7d`
- `GRACE/PAST_DUE` + `now > graceEndsAt` → SET LOCKED
- `LOCKED` → redirect `/billing`

### 3.3 Stripe Checkout (Upgrade)

```
/billing → คลิก Upgrade
→ POST /api/billing/checkout → สร้าง Stripe Checkout Session
→ redirect → Stripe hosted page
→ payment success → redirect /billing?success=1
→ Stripe Webhook อัปเดต DB
```

### 3.4 Stripe Webhook `/api/webhooks/stripe`

| Event | Action |
|---|---|
| `checkout.session.completed` | plan=PRO, status=ACTIVE |
| `invoice.payment_succeeded` | status=ACTIVE, reset graceEndsAt |
| `invoice.payment_failed` | status=PAST_DUE, graceEndsAt=now+7d |
| `customer.subscription.deleted` | status=CANCELLED |

### 3.5 Add-on (+$1/10ชิ้น)

Add-on เป็น **Stripe Subscription item แยก** ผูกกับ subscription หลัก — จ่ายรายเดือนอัตโนมัติพร้อมกับ Pro plan:

```
/billing → เลือกจำนวน slots ที่ต้องการเพิ่ม (10/20/30 ชิ้น)
→ POST /api/billing/addon → update Stripe Subscription quantity
→ webhook invoice.payment_succeeded → addonItems = quantity ใหม่
```

ยกเลิก add-on ได้ผ่าน Stripe Customer Portal (ลด quantity → รอรอบบิลถัดไป)

---

## 4. Billing UI — `/billing` (Shop App)

เห็นได้เฉพาะ SHOP_ADMIN ขึ้นไป

### 4.1 Sections

**ส่วนบน — Current Plan Card**
- Plan name + status badge
- วันต่ออายุ / วันหมด trial
- ราคา/เดือน

**ส่วนกลาง — Usage**
- Progress bar แต่ละ resource: Users / อะไหล่ / พันธมิตร / สาขา
- แสดง X/limit ชัดเจน

**ส่วนล่าง — Add-on + Actions**
- ซื้อ add-on อะไหล่เพิ่ม
- ปุ่ม "จัดการการชำระเงิน" → Stripe Customer Portal
- ปุ่ม "ดูใบเสร็จ" → Stripe Customer Portal

### 4.2 State ตาม Subscription Status

| Status | UI |
|---|---|
| `TRIALING` | Banner ฟ้า "เหลืออีก X วัน" + ปุ่ม Upgrade โดดเด่น |
| `ACTIVE` | แสดงปกติ |
| `GRACE` | Banner แดง "บัญชีหมดอายุ เหลือ X วัน" + ปุ่ม Upgrade |
| `PAST_DUE` | Banner แดง "ชำระเงินไม่สำเร็จ" + ปุ่มอัปเดตบัตร |
| `LOCKED` | Overlay บังทั้งแอพ ใช้ได้แค่หน้า /billing |

### 4.3 Locked Overlay

Overlay บังทุกหน้า เมื่อ status = LOCKED:
```
🔒 บัญชีถูกระงับชั่วคราว
ข้อมูลของคุณยังอยู่ครบถ้วน
[ Upgrade เป็น Pro — 1,000฿/เดือน ]
[ ติดต่อฝ่าย Support ]
```

---

## 5. Admin Portal (`apps/admin-portal`)

### 5.1 Auth

Login ด้วย email/password จาก `.env` — ไม่เก็บใน DB:
```env
PLATFORM_ADMIN_EMAIL=owner@ddcar.com
PLATFORM_ADMIN_PASSWORD_HASH=bcrypt_hash
```

### 5.2 Pages

| Path | Feature |
|---|---|
| `/platform` | Dashboard — จำนวนร้าน, active subs, MRR |
| `/platform/shops` | รายชื่อร้านทั้งหมด + สถานะ |
| `/platform/users` | ค้นหา user ทุกคนข้ามร้าน |
| `/platform/revenue` | MRR, payment history (Stripe API) |
| `/platform/plan-limits` | CRUD limit ทุก plan |

### 5.3 Shop Actions

- **Ban Shop** — status = LOCKED ทันที, users เข้าไม่ได้
- **Adjust Plan** — เปลี่ยน plan / ต่ออายุด้วยมือ (bypass Stripe)
- **Impersonate** → สร้าง JWT token TTL 1 ชั่วโมง → redirect เข้า shop app → banner "กำลัง impersonate ร้าน X" → ปุ่ม Exit กลับ portal

### 5.4 User Actions

- **Ban User** — `isActive = false`, session invalidate ทันที
- **Toggle Permission** — เปลี่ยน role

### 5.5 Online Status

อัปเดต `User.lastActivityAt` ใน middleware ทุก authenticated request

| | เงื่อนไข |
|---|---|
| 🟢 Online | lastActivityAt < 5 นาที |
| 🟡 Away | 5–30 นาที |
| ⚫ Offline | > 30 นาที |

### 5.6 Plan Limits CRUD `/platform/plan-limits`

Table แสดง PlanLimit ทุก plan แก้ไขได้ inline — บันทึก → revalidate cache ทันที

---

## 6. Dark / Light Mode

ทั้ง 2 apps (shop + admin-portal):

- ปุ่ม 🌙/☀️ ใน navbar
- บันทึก preference ใน `localStorage` key `theme`
- ใช้ Ant Design `ConfigProvider` สลับ `theme.algorithm`:
  - Light: `theme.defaultAlgorithm`
  - Dark: `theme.darkAlgorithm`
- Default: Light

---

## 7. Implementation Order

| ลำดับ | งาน |
|---|---|
| 1 | Monorepo restructure — ย้าย ddcar → `apps/shop`, สร้าง `packages/db` |
| 2 | Schema migration — Subscription, PlanLimit, lastActivityAt |
| 3 | Self-signup — `/signup` + Subscription create |
| 4 | Limit enforcement — middleware + API checks + 402 responses |
| 5 | Stripe integration — Checkout, Webhook, Customer Portal, Add-on |
| 6 | Billing UI — `/billing` + locked overlay |
| 7 | Admin Portal — scaffold, auth, pages ทีละหน้า |
| 8 | Dark/Light mode — ทั้ง 2 apps |
