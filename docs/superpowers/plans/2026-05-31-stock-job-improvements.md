# Phase 2A: Stock System + Job Form Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มระบบคลังอะไหล่ (StockItem), ปรับ Job Form เป็น 6 steps (+ assignedTo + parts), สถานะใหม่ 2 ตัว, stock deduction logic ผูกกับ status transitions, และหน้า Stock Management + Transfers

**Architecture:** Prisma schema เพิ่ม 6 models (StockItem, JobPart, StockAdjustLog, StockTransfer, StockTransferItem, TransferDispute) + TransferStatus enum. Stock deduction รันใน Prisma transaction ใน PATCH /api/jobs/[id] เมื่อ status field เปลี่ยน. Job form (page.tsx) เพิ่ม step 5 อะไหล่ รวมเป็น 6 steps. Stock pages ใหม่ที่ /stock/*.

**Tech Stack:** Next.js 14 App Router, Prisma (PostgreSQL), Ant Design 5, Auth.js v5

---

## File Map

**สร้างใหม่:**
- `src/app/api/stock/route.ts` — GET list / POST create stock item
- `src/app/api/stock/[id]/route.ts` — GET single (+ logs) / PATCH metadata
- `src/app/api/stock/[id]/adjust/route.ts` — POST adjust qty
- `src/app/api/stock/transfers/route.ts` — GET list / POST create branch transfer
- `src/app/api/stock/transfers/[id]/route.ts` — PATCH status (DELIVERED / CANCELLED)
- `src/app/api/stock/transfers/[id]/dispute/route.ts` — POST dispute
- `src/app/api/users/techs/route.ts` — GET TECH+LEAD_TECH list for shop
- `src/app/stock/page.tsx` — stock list server component
- `src/app/stock/StockTable.tsx` — stock table client component
- `src/app/stock/new/page.tsx` — create stock item form
- `src/app/stock/[id]/edit/page.tsx` — edit stock item metadata form
- `src/app/stock/[id]/adjust/page.tsx` — adjust qty form
- `src/app/stock/transfers/page.tsx` — transfers list server component
- `src/app/stock/transfers/TransfersTable.tsx` — transfers table client component
- `src/app/stock/transfers/new/page.tsx` — create branch transfer form

**แก้ไข:**
- `prisma/schema.prisma` — add 6 models + TransferStatus enum, modify Job/User/Shop
- `src/app/api/jobs/route.ts` — POST: accept assignedTo + parts, create JobPart records
- `src/app/api/jobs/[id]/route.ts` — GET: include jobParts; PATCH: add stock deduction logic
- `src/app/page.tsx` — 6-step form: add assignedTo step0, new statuses step3, parts step4, images→step5
- `src/app/edit/[id]/page.tsx` — add assignedTo, update statuses, add parts section
- `src/app/layout.tsx` — add คลังอะไหล่ nav link for SUPER_ADMIN/SHOP_ADMIN/LEAD_TECH
- `src/middleware.ts` — block /stock for TECH

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace prisma/schema.prisma**

แทนที่ทั้งไฟล์ด้วย:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-arm64-openssl-3.0.x", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  SUPER_ADMIN
  SHOP_ADMIN
  LEAD_TECH
  TECH
}

enum TransferStatus {
  PENDING
  IN_TRANSIT
  DELIVERED
  DISPUTED
  REJECTED
  CANCELLED
}

model Shop {
  id            String          @id @default(cuid())
  refCode       String          @unique
  name          String
  parentId      String?
  parent        Shop?           @relation("ShopBranches", fields: [parentId], references: [id])
  branches      Shop[]          @relation("ShopBranches")
  users         User[]
  jobs          Job[]
  stockItems    StockItem[]
  transfersFrom StockTransfer[] @relation("TransferFrom")
  transfersTo   StockTransfer[] @relation("TransferTo")
  createdAt     DateTime        @default(now())
}

model User {
  id           String   @id @default(cuid())
  email        String
  password     String
  name         String
  role         Role
  isActive     Boolean  @default(true)
  shopId       String
  shop         Shop     @relation(fields: [shopId], references: [id])
  createdJobs  Job[]    @relation("CreatedBy")
  assignedJobs Job[]    @relation("AssignedJobs")
  createdAt    DateTime @default(now())

  @@unique([email, shopId])
}

model Job {
  id           String    @id @default(cuid())
  jobNo        String    @unique
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
  shopId       String?
  createdBy    String?
  assignedTo   String?
  stockStatus  String    @default("none")
  shop         Shop?     @relation(fields: [shopId], references: [id])
  creator      User?     @relation("CreatedBy", fields: [createdBy], references: [id])
  assignedUser User?     @relation("AssignedJobs", fields: [assignedTo], references: [id])
  createdAt    DateTime  @default(now())
  images       Image[]
  jobParts     JobPart[]
}

model Image {
  id        String   @id @default(cuid())
  jobId     String
  filename  String
  createdAt DateTime @default(now())
  job       Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
}

model StockItem {
  id            String             @id @default(cuid())
  shopId        String
  shop          Shop               @relation(fields: [shopId], references: [id])
  name          String
  category      String
  unit          String
  quantity      Float
  reserved      Float              @default(0)
  costPrice     Float
  supplierPhone String?
  warrantyStart DateTime?
  warrantyEnd   DateTime?
  createdAt     DateTime           @default(now())
  jobParts      JobPart[]
  adjustLogs    StockAdjustLog[]
  transferItems StockTransferItem[]

  @@index([shopId])
}

model JobPart {
  id          String    @id @default(cuid())
  jobId       String
  job         Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)
  stockItemId String
  stockItem   StockItem @relation(fields: [stockItemId], references: [id])
  quantity    Float

  @@unique([jobId, stockItemId])
}

model StockAdjustLog {
  id          String    @id @default(cuid())
  stockItemId String
  stockItem   StockItem @relation(fields: [stockItemId], references: [id])
  delta       Float
  reason      String
  userId      String
  createdAt   DateTime  @default(now())
}

model StockTransfer {
  id           String              @id @default(cuid())
  type         String
  fromShopId   String
  toShopId     String
  fromShop     Shop                @relation("TransferFrom", fields: [fromShopId], references: [id])
  toShop       Shop                @relation("TransferTo", fields: [toShopId], references: [id])
  status       TransferStatus      @default(PENDING)
  deliveryDate DateTime
  receivedAt   DateTime?
  unitPrice    Float?
  note         String?
  requestedBy  String
  items        StockTransferItem[]
  disputes     TransferDispute[]
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
}

model StockTransferItem {
  id          String        @id @default(cuid())
  transferId  String
  transfer    StockTransfer @relation(fields: [transferId], references: [id], onDelete: Cascade)
  stockItemId String
  stockItem   StockItem     @relation(fields: [stockItemId], references: [id])
  quantity    Float
}

model TransferDispute {
  id         String        @id @default(cuid())
  transferId String
  transfer   StockTransfer @relation(fields: [transferId], references: [id])
  raisedBy   String
  message    String
  createdAt  DateTime      @default(now())
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-stock-system
```

Expected: สร้าง `prisma/migrations/..._add_stock_system/migration.sql` และ regenerate Prisma client

- [ ] **Step 3: Verify generate**

```bash
npx prisma generate
```

Expected: ไม่มี error, output แสดง `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add stock system models to prisma schema"
```

---

## Task 2: Stock Items API

**Files:**
- Create: `src/app/api/stock/route.ts`
- Create: `src/app/api/stock/[id]/route.ts`
- Create: `src/app/api/stock/[id]/adjust/route.ts`

- [ ] **Step 1: Create src/app/api/stock/route.ts**

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { shopId } = session.user
  const available = req.nextUrl.searchParams.get('available') === 'true'

  const items = await prisma.stockItem.findMany({
    where: { shopId },
    orderBy: { name: 'asc' },
  })

  const result = items.map(i => ({ ...i, availableQty: i.quantity - i.reserved }))
  return Response.json(available ? result.filter(i => i.availableQty > 0) : result)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId } = session.user
  if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, category, unit, quantity, costPrice, supplierPhone, warrantyStart, warrantyEnd } = body

  if (!name?.trim() || !category?.trim() || !unit?.trim() || quantity == null || costPrice == null) {
    return Response.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 422 })
  }

  const item = await prisma.stockItem.create({
    data: {
      shopId,
      name: String(name).trim(),
      category: String(category).trim(),
      unit: String(unit).trim(),
      quantity: Number(quantity),
      costPrice: Number(costPrice),
      supplierPhone: supplierPhone ? String(supplierPhone).trim() : null,
      warrantyStart: warrantyStart ? new Date(warrantyStart) : null,
      warrantyEnd: warrantyEnd ? new Date(warrantyEnd) : null,
    },
  })

  return Response.json(item, { status: 201 })
}
```

- [ ] **Step 2: Create src/app/api/stock/[id]/route.ts**

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId } = session.user
  if (role === 'TECH') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const item = await prisma.stockItem.findFirst({
    where: { id: params.id, shopId },
    include: {
      adjustLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  })
  if (!item) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({ ...item, availableQty: item.quantity - item.reserved })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId } = session.user
  if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = await prisma.stockItem.findFirst({ where: { id: params.id, shopId } })
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}

  if ('name'          in body) data.name          = String(body.name).trim()
  if ('category'      in body) data.category      = String(body.category).trim()
  if ('unit'          in body) data.unit          = String(body.unit).trim()
  if ('costPrice'     in body) data.costPrice     = Number(body.costPrice)
  if ('supplierPhone' in body) data.supplierPhone = body.supplierPhone || null
  if ('warrantyStart' in body) data.warrantyStart = body.warrantyStart ? new Date(body.warrantyStart) : null
  if ('warrantyEnd'   in body) data.warrantyEnd   = body.warrantyEnd   ? new Date(body.warrantyEnd)   : null

  if (Object.keys(data).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 422 })
  }

  const updated = await prisma.stockItem.update({ where: { id: params.id }, data })
  return Response.json(updated)
}
```

- [ ] **Step 3: Create src/app/api/stock/[id]/adjust/route.ts**

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const VALID_REASONS = ['รับของ', 'ตัดของหาย', 'ปรับปรุงยอด']

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId, id: userId } = session.user
  if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const item = await prisma.stockItem.findFirst({ where: { id: params.id, shopId } })
  if (!item) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { delta, reason } = body

  if (delta == null || isNaN(Number(delta)) || Number(delta) === 0) {
    return Response.json({ error: 'delta ต้องเป็นตัวเลขที่ไม่ใช่ 0' }, { status: 422 })
  }
  if (!reason || !VALID_REASONS.includes(String(reason))) {
    return Response.json({ error: `reason ต้องเป็น: ${VALID_REASONS.join(', ')}` }, { status: 422 })
  }

  const numDelta = Number(delta)
  const newQty = item.quantity + numDelta
  if (newQty < 0) {
    return Response.json({ error: 'จำนวนคงเหลือจะติดลบ' }, { status: 422 })
  }

  const [updated] = await prisma.$transaction([
    prisma.stockItem.update({
      where: { id: params.id },
      data: { quantity: { increment: numDelta } },
    }),
    prisma.stockAdjustLog.create({
      data: { stockItemId: params.id, delta: numDelta, reason: String(reason), userId },
    }),
  ])

  return Response.json(updated)
}
```

- [ ] **Step 4: Test stock APIs**

```bash
# สร้าง stock item (ต้อง login ก่อน — ใช้ cookie จาก browser หรือ test ผ่าน jest)
curl -s http://localhost/api/stock | python3 -m json.tool
```

Expected: `[]` (ยังไม่มีข้อมูล)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stock/
git commit -m "feat: add stock items API (list, create, get, update, adjust)"
```

---

## Task 3: Stock Transfers API

**Files:**
- Create: `src/app/api/stock/transfers/route.ts`
- Create: `src/app/api/stock/transfers/[id]/route.ts`
- Create: `src/app/api/stock/transfers/[id]/dispute/route.ts`

- [ ] **Step 1: Create src/app/api/stock/transfers/route.ts**

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId } = session.user
  if (role === 'TECH') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const type = req.nextUrl.searchParams.get('type') || undefined

  const transfers = await prisma.stockTransfer.findMany({
    where: {
      OR: [{ fromShopId: shopId }, { toShopId: shopId }],
      ...(type ? { type } : {}),
    },
    include: {
      fromShop: { select: { name: true } },
      toShop:   { select: { name: true } },
      items:    { include: { stockItem: { select: { name: true, unit: true } } } },
      disputes: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json(transfers)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId, id: userId } = session.user
  if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { toShopId, deliveryDate, note, items } = body

  if (!toShopId || !deliveryDate || !Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 422 })
  }
  if (toShopId === shopId) {
    return Response.json({ error: 'ปลายทางต้องไม่ใช่ร้านตัวเอง' }, { status: 422 })
  }

  // Validate all stock items belong to fromShop
  const stockIds = items.map((i: { stockItemId: string }) => i.stockItemId)
  const stockItems = await prisma.stockItem.findMany({
    where: { id: { in: stockIds }, shopId },
  })
  if (stockItems.length !== stockIds.length) {
    return Response.json({ error: 'อะไหล่บางรายการไม่พบในร้านนี้' }, { status: 422 })
  }

  const transfer = await prisma.$transaction(async (tx) => {
    const created = await tx.stockTransfer.create({
      data: {
        type: 'BRANCH',
        fromShopId: shopId,
        toShopId,
        status: 'IN_TRANSIT',
        deliveryDate: new Date(deliveryDate),
        note: note || null,
        requestedBy: userId,
        items: {
          create: items.map((i: { stockItemId: string; quantity: number }) => ({
            stockItemId: i.stockItemId,
            quantity: i.quantity,
          })),
        },
      },
      include: { items: true },
    })

    // Soft reserve on fromShop items
    for (const item of items as { stockItemId: string; quantity: number }[]) {
      await tx.stockItem.update({
        where: { id: item.stockItemId },
        data: { reserved: { increment: item.quantity } },
      })
    }

    return created
  })

  return Response.json(transfer, { status: 201 })
}
```

- [ ] **Step 2: Create src/app/api/stock/transfers/[id]/route.ts**

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId, id: userId } = session.user
  if (role === 'TECH') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: params.id },
    include: { items: { include: { stockItem: true } } },
  })
  if (!transfer) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { status } = body

  if (status === 'DELIVERED') {
    // Only destination shop can confirm delivery
    if (transfer.toShopId !== shopId) {
      return Response.json({ error: 'เฉพาะปลายทางเท่านั้นที่ยืนยันรับได้' }, { status: 403 })
    }
    if (transfer.status !== 'IN_TRANSIT' && transfer.status !== 'DISPUTED') {
      return Response.json({ error: 'สถานะปัจจุบันไม่สามารถยืนยันรับได้' }, { status: 422 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockTransfer.update({
        where: { id: params.id },
        data: { status: 'DELIVERED', receivedAt: new Date() },
      })

      for (const item of transfer.items) {
        // Deduct from source shop
        await tx.stockItem.update({
          where: { id: item.stockItemId },
          data: {
            quantity: { decrement: item.quantity },
            reserved: { decrement: item.quantity },
          },
        })
        await tx.stockAdjustLog.create({
          data: {
            stockItemId: item.stockItemId,
            delta: -item.quantity,
            reason: `transfer:${params.id}`,
            userId,
          },
        })

        // Add to destination shop — find or create matching item
        const destItem = await tx.stockItem.findFirst({
          where: { shopId: transfer.toShopId, name: item.stockItem.name },
        })
        if (destItem) {
          await tx.stockItem.update({
            where: { id: destItem.id },
            data: { quantity: { increment: item.quantity } },
          })
          await tx.stockAdjustLog.create({
            data: {
              stockItemId: destItem.id,
              delta: item.quantity,
              reason: `transfer:${params.id}`,
              userId,
            },
          })
        } else {
          await tx.stockItem.create({
            data: {
              shopId: transfer.toShopId,
              name: item.stockItem.name,
              category: item.stockItem.category,
              unit: item.stockItem.unit,
              quantity: item.quantity,
              costPrice: item.stockItem.costPrice,
            },
          })
        }
      }
    })

    return Response.json({ ok: true })
  }

  if (status === 'CANCELLED') {
    if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (transfer.fromShopId !== shopId) {
      return Response.json({ error: 'เฉพาะต้นทางเท่านั้นที่ยกเลิกได้' }, { status: 403 })
    }
    if (transfer.status === 'DELIVERED') {
      return Response.json({ error: 'ไม่สามารถยกเลิก transfer ที่ส่งแล้ว' }, { status: 422 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockTransfer.update({
        where: { id: params.id },
        data: { status: 'CANCELLED' },
      })
      for (const item of transfer.items) {
        await tx.stockItem.update({
          where: { id: item.stockItemId },
          data: { reserved: { decrement: item.quantity } },
        })
      }
    })

    return Response.json({ ok: true })
  }

  return Response.json({ error: 'status ที่รองรับ: DELIVERED, CANCELLED' }, { status: 422 })
}
```

- [ ] **Step 3: Create src/app/api/stock/transfers/[id]/dispute/route.ts**

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId, id: userId } = session.user
  if (role === 'TECH') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const transfer = await prisma.stockTransfer.findUnique({ where: { id: params.id } })
  if (!transfer) return Response.json({ error: 'Not found' }, { status: 404 })

  if (transfer.toShopId !== shopId) {
    return Response.json({ error: 'เฉพาะปลายทางเท่านั้นที่ร้องขอได้' }, { status: 403 })
  }
  if (transfer.status !== 'IN_TRANSIT') {
    return Response.json({ error: 'ร้องขอได้เฉพาะสถานะ IN_TRANSIT เท่านั้น' }, { status: 422 })
  }

  const body = await req.json()
  const { message } = body
  if (!message?.trim()) {
    return Response.json({ error: 'กรุณาระบุรายละเอียด' }, { status: 422 })
  }

  await prisma.$transaction([
    prisma.stockTransfer.update({
      where: { id: params.id },
      data: { status: 'DISPUTED' },
    }),
    prisma.transferDispute.create({
      data: { transferId: params.id, raisedBy: userId, message: String(message).trim() },
    }),
  ])

  return Response.json({ ok: true })
}
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/stock/transfers/"
git commit -m "feat: add stock transfers API (create, confirm, cancel, dispute)"
```

---

## Task 4: Techs API + Update Jobs [id] GET

**Files:**
- Create: `src/app/api/users/techs/route.ts`
- Modify: `src/app/api/jobs/[id]/route.ts` (GET only)

- [ ] **Step 1: Create src/app/api/users/techs/route.ts**

```typescript
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const techs = await prisma.user.findMany({
    where: {
      shopId: session.user.shopId,
      role: { in: ['TECH', 'LEAD_TECH'] },
      isActive: true,
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })

  return Response.json(techs)
}
```

- [ ] **Step 2: Update GET in src/app/api/jobs/[id]/route.ts — include jobParts**

เปลี่ยนบรรทัด `include` ใน `prisma.job.findFirst` จาก:

```typescript
include: { images: { select: { id: true, filename: true } } },
```

เป็น:

```typescript
include: {
  images: { select: { id: true, filename: true } },
  jobParts: {
    include: { stockItem: { select: { id: true, name: true, category: true, unit: true } } },
  },
},
```

- [ ] **Step 3: Build ตรวจสอบ TypeScript**

```bash
npm run build 2>&1 | grep -E "error TS" | head -10
```

Expected: ไม่มี TypeScript error

- [ ] **Step 4: Commit**

```bash
git add src/app/api/users/ src/app/api/jobs/
git commit -m "feat: add techs API, include jobParts in GET /api/jobs/[id]"
```

---

## Task 5: Update POST /api/jobs — assignedTo + parts

**Files:**
- Modify: `src/app/api/jobs/route.ts`

- [ ] **Step 1: Update POST handler in src/app/api/jobs/route.ts**

เพิ่ม `assignedTo` และ `parts` ใน POST handler. แทนที่ทั้ง POST function:

```typescript
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { shopId, id: userId } = session.user

    const body = await request.json()
    const {
      date, time, customerName, phone,
      licensePlate, odometer, symptoms,
      notes, cause, totalPrice, status,
      assignedTo, parts,
    } = body

    const missing = [date, time, customerName, phone, licensePlate, odometer, cause, totalPrice, status]
      .some(v => v === undefined || v === null || v === '')
    if (missing) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 422 })
    }

    const jobNo = await generateJobNo(date as string)

    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.job.create({
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
          shopId,
          createdBy: userId,
          assignedTo: assignedTo || null,
        },
      })

      if (Array.isArray(parts) && parts.length > 0) {
        await tx.jobPart.createMany({
          data: (parts as { stockItemId: string; quantity: number }[]).map(p => ({
            jobId: created.id,
            stockItemId: p.stockItemId,
            quantity: p.quantity,
          })),
        })
      }

      return created
    })

    return NextResponse.json({ id: job.id, jobNo: job.jobNo }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/jobs]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/jobs/route.ts
git commit -m "feat: POST /api/jobs accepts assignedTo and parts"
```

---

## Task 6: Update PATCH /api/jobs/[id] — Stock Deduction Logic

**Files:**
- Modify: `src/app/api/jobs/[id]/route.ts`

- [ ] **Step 1: Replace PATCH handler in src/app/api/jobs/[id]/route.ts**

แทนที่ทั้ง PATCH function:

```typescript
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { shopId, role, id: userId } = session.user

    const existing = await prisma.job.findFirst({
      where: { id: params.id, shopId },
      include: { jobParts: true },
    })
    if (!existing) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    if (role === 'TECH' && existing.createdBy !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {}

    if ('date'         in body) data.date         = String(body.date)
    if ('time'         in body) data.time         = String(body.time)
    if ('customerName' in body) data.customerName = String(body.customerName)
    if ('phone'        in body) data.phone        = String(body.phone)
    if ('licensePlate' in body) data.licensePlate = String(body.licensePlate)
    if ('odometer'     in body) data.odometer     = Number(body.odometer)
    if ('symptoms'     in body) data.symptoms     = Array.isArray(body.symptoms) ? body.symptoms : []
    if ('notes'        in body) data.notes        = body.notes || null
    if ('cause'        in body) data.cause        = String(body.cause)
    if ('totalPrice'   in body) data.totalPrice   = Number(body.totalPrice)
    if ('status'       in body) data.status       = String(body.status)
    if ('assignedTo'   in body) data.assignedTo   = body.assignedTo || null

    // Parts update (only allowed when stockStatus === 'none')
    let newParts: { stockItemId: string; quantity: number }[] | null = null
    if ('parts' in body && existing.stockStatus === 'none') {
      newParts = body.parts as { stockItemId: string; quantity: number }[]
    }

    // Determine stock action from status transition
    const newStatus = 'status' in body ? String(body.status) : null
    const currentStockStatus = existing.stockStatus

    type StockAction = 'reserve' | 'deduct' | 'release' | null
    let stockAction: StockAction = null

    if (newStatus && newStatus !== existing.status) {
      if (newStatus === 'อยู่ระหว่างดำเนินการ' && currentStockStatus === 'none') {
        stockAction = 'reserve'
      } else if (newStatus === 'ส่งมอบและเก็บเงินแล้ว' && currentStockStatus === 'reserved') {
        stockAction = 'deduct'
      } else if (newStatus === 'ยกเลิกรายการแล้ว' && currentStockStatus === 'reserved') {
        stockAction = 'release'
      }
    }

    if (Object.keys(data).length === 0 && newParts === null && !stockAction) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 422 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update parts if applicable
      if (newParts !== null) {
        await tx.jobPart.deleteMany({ where: { jobId: params.id } })
        if (newParts.length > 0) {
          await tx.jobPart.createMany({
            data: newParts.map(p => ({
              jobId: params.id,
              stockItemId: p.stockItemId,
              quantity: p.quantity,
            })),
          })
        }
      }

      // Determine which parts to process for stock actions
      const partsToProcess = newParts !== null
        ? newParts
        : existing.jobParts.map(p => ({ stockItemId: p.stockItemId, quantity: p.quantity }))

      if (stockAction === 'reserve') {
        for (const part of partsToProcess) {
          await tx.stockItem.update({
            where: { id: part.stockItemId },
            data: { reserved: { increment: part.quantity } },
          })
        }
        data.stockStatus = 'reserved'
      } else if (stockAction === 'deduct') {
        for (const part of partsToProcess) {
          await tx.stockItem.update({
            where: { id: part.stockItemId },
            data: {
              quantity: { decrement: part.quantity },
              reserved: { decrement: part.quantity },
            },
          })
          await tx.stockAdjustLog.create({
            data: {
              stockItemId: part.stockItemId,
              delta: -part.quantity,
              reason: `job:${params.id}`,
              userId,
            },
          })
        }
        data.stockStatus = 'deducted'
      } else if (stockAction === 'release') {
        for (const part of partsToProcess) {
          await tx.stockItem.update({
            where: { id: part.stockItemId },
            data: { reserved: { decrement: part.quantity } },
          })
        }
        data.stockStatus = 'none'
      }

      return tx.job.update({
        where: { id: params.id },
        data,
        include: {
          jobParts: { include: { stockItem: { select: { id: true, name: true, unit: true } } } },
        },
      })
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/jobs/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Build ตรวจสอบ TypeScript**

```bash
npm run build 2>&1 | grep -E "error TS" | head -10
```

Expected: ไม่มี TypeScript error

- [ ] **Step 3: Commit**

```bash
git add src/app/api/jobs/
git commit -m "feat: PATCH /api/jobs/[id] stock deduction logic on status transitions"
```

---

## Task 7: Stock List Page

**Files:**
- Create: `src/app/stock/page.tsx`
- Create: `src/app/stock/StockTable.tsx`

- [ ] **Step 1: Create src/app/stock/page.tsx**

```typescript
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import StockTable from './StockTable'

const { Title } = Typography

export default async function StockPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, shopId } = session.user
  if (role === 'TECH') redirect('/')

  const items = await prisma.stockItem.findMany({
    where: { shopId },
    orderBy: { name: 'asc' },
  })

  const data = items.map(i => ({ ...i, availableQty: i.quantity - i.reserved }))
  const canEdit = role === 'SUPER_ADMIN' || role === 'SHOP_ADMIN'

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>คลังอะไหล่</Title>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && (
            <Link href="/stock/transfers/new">
              <Button>โอนอะไหล่</Button>
            </Link>
          )}
          <Link href="/stock/transfers">
            <Button>ประวัติการโอน</Button>
          </Link>
          {canEdit && (
            <Link href="/stock/new">
              <Button type="primary" icon={<PlusOutlined />}>เพิ่มอะไหล่</Button>
            </Link>
          )}
        </div>
      </div>
      <StockTable items={data} canEdit={canEdit} />
    </div>
  )
}
```

- [ ] **Step 2: Create src/app/stock/StockTable.tsx**

```typescript
'use client'

import { Table, Tag, Button, Space } from 'antd'
import Link from 'next/link'
import dayjs from 'dayjs'

interface StockItemRow {
  id: string
  name: string
  category: string
  unit: string
  quantity: number
  reserved: number
  availableQty: number
  costPrice: number
  warrantyEnd: Date | null
}

interface Props {
  items: StockItemRow[]
  canEdit: boolean
}

export default function StockTable({ items, canEdit }: Props) {
  const now = dayjs()

  const columns = [
    {
      title: 'ชื่ออะไหล่',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: StockItemRow) => {
        const low = record.availableQty < 5
        return (
          <span style={{ color: low ? '#dc2626' : undefined, fontWeight: low ? 600 : undefined }}>
            {name}
          </span>
        )
      },
    },
    {
      title: 'หมวดหมู่',
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit' },
    {
      title: 'คงเหลือ',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
    },
    {
      title: 'จอง',
      dataIndex: 'reserved',
      key: 'reserved',
      align: 'right' as const,
      render: (v: number) => <span style={{ color: v > 0 ? '#d97706' : '#94a3b8' }}>{v}</span>,
    },
    {
      title: 'พร้อมใช้',
      dataIndex: 'availableQty',
      key: 'availableQty',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: v < 5 ? '#dc2626' : '#16a34a' }}>{v}</span>
      ),
    },
    {
      title: 'ราคาทุน',
      dataIndex: 'costPrice',
      key: 'costPrice',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    {
      title: 'หมดประกัน',
      dataIndex: 'warrantyEnd',
      key: 'warrantyEnd',
      render: (v: Date | null) => {
        if (!v) return <span style={{ color: '#94a3b8' }}>-</span>
        const d = dayjs(v)
        const soonExpiry = d.diff(now, 'day') <= 30
        return (
          <span style={{ color: soonExpiry ? '#d97706' : undefined }}>
            {d.format('DD/MM/YYYY')}
          </span>
        )
      },
    },
    ...(canEdit
      ? [
          {
            title: '',
            key: 'actions',
            render: (_: unknown, record: StockItemRow) => (
              <Space size="small">
                <Link href={`/stock/${record.id}/adjust`}>
                  <Button size="small">ปรับยอด</Button>
                </Link>
                <Link href={`/stock/${record.id}/edit`}>
                  <Button size="small">แก้ไข</Button>
                </Link>
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <Table
      dataSource={items}
      columns={columns}
      rowKey="id"
      pagination={false}
      size="small"
    />
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/stock/page.tsx src/app/stock/StockTable.tsx
git commit -m "feat: add stock list page with table"
```

---

## Task 8: Stock Item Forms (New, Edit, Adjust)

**Files:**
- Create: `src/app/stock/new/page.tsx`
- Create: `src/app/stock/[id]/edit/page.tsx`
- Create: `src/app/stock/[id]/adjust/page.tsx`

- [ ] **Step 1: Create src/app/stock/new/page.tsx**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, InputNumber, Select, Button, Card, Typography, Alert, DatePicker } from 'antd'

const { Title } = Typography

const CATEGORIES = ['น้ำมัน', 'ยาง', 'ไฟฟ้า', 'ช่วงล่าง', 'อื่นๆ']
const UNITS = ['ชิ้น', 'ลิตร', 'กก.', 'ม้วน']

export default function NewStockItemPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFinish(values: Record<string, unknown>) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          warrantyStart: values.warrantyStart ? (values.warrantyStart as import('dayjs').Dayjs).toISOString() : null,
          warrantyEnd:   values.warrantyEnd   ? (values.warrantyEnd   as import('dayjs').Dayjs).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/stock')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 560 }}>
      <Title level={4}>เพิ่มอะไหล่ใหม่</Title>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="ชื่ออะไหล่" name="name" rules={[{ required: true }]}>
            <Input placeholder="เช่น น้ำมันเครื่อง 10W-40" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="หมวดหมู่" name="category" rules={[{ required: true }]}>
              <Select options={CATEGORIES.map(c => ({ label: c, value: c }))} />
            </Form.Item>
            <Form.Item label="หน่วย" name="unit" rules={[{ required: true }]}>
              <Select options={UNITS.map(u => ({ label: u, value: u }))} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="จำนวนเริ่มต้น" name="quantity" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item label="ราคาทุน (บาท)" name="costPrice" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} />
            </Form.Item>
          </div>
          <Form.Item label="เบอร์ร้านอะไหล่ (ถ้ามี)" name="supplierPhone">
            <Input placeholder="เบอร์โทรร้านขายอะไหล่" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="วันเริ่มรับประกัน" name="warrantyStart">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="วันหมดประกัน" name="warrantyEnd">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => router.back()}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={loading}>เพิ่มอะไหล่</Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create src/app/stock/[id]/edit/page.tsx**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Form, Input, InputNumber, Select, Button, Card, Typography, Alert, DatePicker, Spin } from 'antd'
import dayjs from 'dayjs'

const { Title } = Typography
const CATEGORIES = ['น้ำมัน', 'ยาง', 'ไฟฟ้า', 'ช่วงล่าง', 'อื่นๆ']
const UNITS = ['ชิ้น', 'ลิตร', 'กก.', 'ม้วน']

export default function EditStockItemPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/stock/${params.id}`)
      .then(r => r.json())
      .then(item => {
        form.setFieldsValue({
          name: item.name,
          category: item.category,
          unit: item.unit,
          costPrice: item.costPrice,
          supplierPhone: item.supplierPhone,
          warrantyStart: item.warrantyStart ? dayjs(item.warrantyStart) : null,
          warrantyEnd:   item.warrantyEnd   ? dayjs(item.warrantyEnd)   : null,
        })
      })
      .finally(() => setFetching(false))
  }, [params.id, form])

  async function onFinish(values: Record<string, unknown>) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/stock/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          warrantyStart: values.warrantyStart ? (values.warrantyStart as import('dayjs').Dayjs).toISOString() : null,
          warrantyEnd:   values.warrantyEnd   ? (values.warrantyEnd   as import('dayjs').Dayjs).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/stock')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) return <div style={{ padding: '2rem' }}><Spin /></div>

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 560 }}>
      <Title level={4}>แก้ไขข้อมูลอะไหล่</Title>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="ชื่ออะไหล่" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="หมวดหมู่" name="category" rules={[{ required: true }]}>
              <Select options={CATEGORIES.map(c => ({ label: c, value: c }))} />
            </Form.Item>
            <Form.Item label="หน่วย" name="unit" rules={[{ required: true }]}>
              <Select options={UNITS.map(u => ({ label: u, value: u }))} />
            </Form.Item>
          </div>
          <Form.Item label="ราคาทุน (บาท)" name="costPrice" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item label="เบอร์ร้านอะไหล่" name="supplierPhone">
            <Input />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="วันเริ่มรับประกัน" name="warrantyStart">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="วันหมดประกัน" name="warrantyEnd">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => router.back()}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={loading}>บันทึก</Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Create src/app/stock/[id]/adjust/page.tsx**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Form, InputNumber, Select, Button, Card, Typography, Alert, Spin } from 'antd'

const { Title, Text } = Typography
const REASONS = ['รับของ', 'ตัดของหาย', 'ปรับปรุงยอด']

export default function AdjustStockPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [itemName, setItemName] = useState('')
  const [currentQty, setCurrentQty] = useState(0)

  useEffect(() => {
    fetch(`/api/stock/${params.id}`)
      .then(r => r.json())
      .then(item => { setItemName(item.name); setCurrentQty(item.quantity) })
      .finally(() => setFetching(false))
  }, [params.id])

  async function onFinish({ delta, reason }: { delta: number; reason: string }) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/stock/${params.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta, reason }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/stock')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) return <div style={{ padding: '2rem' }}><Spin /></div>

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 480 }}>
      <Title level={4}>ปรับยอดอะไหล่</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        {itemName} — คงเหลือปัจจุบัน: <strong>{currentQty}</strong>
      </Text>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="จำนวนที่ปรับ (+ รับ / - ตัด)"
            name="delta"
            rules={[{ required: true, message: 'กรุณาระบุจำนวน' }, { validator: (_, v) => v !== 0 ? Promise.resolve() : Promise.reject('ต้องไม่เป็น 0') }]}
          >
            <InputNumber style={{ width: '100%' }} placeholder="เช่น 10 หรือ -3" />
          </Form.Item>
          <Form.Item label="เหตุผล" name="reason" rules={[{ required: true }]}>
            <Select options={REASONS.map(r => ({ label: r, value: r }))} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => router.back()}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={loading}>ปรับยอด</Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/stock/new/" "src/app/stock/[id]/"
git commit -m "feat: add stock item create, edit, adjust pages"
```

---

## Task 9: Stock Transfers Pages

**Files:**
- Create: `src/app/stock/transfers/page.tsx`
- Create: `src/app/stock/transfers/TransfersTable.tsx`
- Create: `src/app/stock/transfers/new/page.tsx`

- [ ] **Step 1: Create src/app/stock/transfers/page.tsx**

```typescript
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Typography } from 'antd'
import TransfersTable from './TransfersTable'

const { Title } = Typography

export default async function TransfersPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, shopId } = session.user
  if (role === 'TECH') redirect('/')

  const transfers = await prisma.stockTransfer.findMany({
    where: { OR: [{ fromShopId: shopId }, { toShopId: shopId }], type: 'BRANCH' },
    include: {
      fromShop: { select: { name: true } },
      toShop:   { select: { name: true } },
      items:    { include: { stockItem: { select: { name: true, unit: true } } } },
      disputes: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <Title level={4} style={{ marginBottom: 16 }}>ประวัติการโอนอะไหล่</Title>
      <TransfersTable transfers={transfers} currentShopId={shopId} canManage={role !== 'TECH'} />
    </div>
  )
}
```

- [ ] **Step 2: Create src/app/stock/transfers/TransfersTable.tsx**

```typescript
'use client'

import { useState } from 'react'
import { Table, Tag, Button, Modal, Input, Space, message } from 'antd'
import dayjs from 'dayjs'

const STATUS_COLORS: Record<string, string> = {
  IN_TRANSIT: 'blue',
  DELIVERED:  'green',
  DISPUTED:   'orange',
  CANCELLED:  'default',
}
const STATUS_LABELS: Record<string, string> = {
  IN_TRANSIT: 'กำลังส่ง',
  DELIVERED:  'ส่งแล้ว',
  DISPUTED:   'ร้องขอ',
  CANCELLED:  'ยกเลิก',
}

interface TransferItem {
  id: string
  quantity: number
  stockItem: { name: string; unit: string }
}

interface Transfer {
  id: string
  fromShop: { name: string }
  toShop: { name: string }
  status: string
  deliveryDate: string
  items: TransferItem[]
  disputes: { message: string }[]
}

interface Props {
  transfers: Transfer[]
  currentShopId: string
  canManage: boolean
}

export default function TransfersTable({ transfers, currentShopId, canManage }: Props) {
  const [disputeId, setDisputeId] = useState<string | null>(null)
  const [disputeMsg, setDisputeMsg] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  async function confirmDelivery(id: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/stock/transfers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DELIVERED' }),
      })
      if (!res.ok) { const d = await res.json(); message.error(d.error); return }
      message.success('ยืนยันรับของสำเร็จ')
      window.location.reload()
    } finally {
      setActionLoading(false)
    }
  }

  async function submitDispute() {
    if (!disputeId || !disputeMsg.trim()) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/stock/transfers/${disputeId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: disputeMsg }),
      })
      if (!res.ok) { const d = await res.json(); message.error(d.error); return }
      message.success('ร้องขอสำเร็จ')
      setDisputeId(null)
      setDisputeMsg('')
      window.location.reload()
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    {
      title: 'ต้นทาง → ปลายทาง',
      key: 'route',
      render: (_: unknown, r: Transfer) => `${r.fromShop.name} → ${r.toShop.name}`,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_COLORS[s] || 'default'}>{STATUS_LABELS[s] || s}</Tag>,
    },
    {
      title: 'วันส่งถึง',
      dataIndex: 'deliveryDate',
      key: 'deliveryDate',
      render: (d: string) => dayjs(d).format('DD/MM/YYYY'),
    },
    {
      title: 'รายการของ',
      dataIndex: 'items',
      key: 'items',
      render: (items: TransferItem[]) =>
        items.map(i => `${i.stockItem.name} ×${i.quantity} ${i.stockItem.unit}`).join(', '),
    },
    ...(canManage
      ? [
          {
            title: '',
            key: 'actions',
            render: (_: unknown, r: Transfer) => {
              const isDestination = r.toShop.name !== undefined
              if (r.status !== 'IN_TRANSIT' && r.status !== 'DISPUTED') return null

              return (
                <Space size="small">
                  <Button
                    size="small"
                    type="primary"
                    loading={actionLoading}
                    onClick={() => confirmDelivery(r.id)}
                  >
                    ยืนยันรับ
                  </Button>
                  {r.status === 'IN_TRANSIT' && (
                    <Button size="small" danger onClick={() => setDisputeId(r.id)}>
                      ร้องขอ
                    </Button>
                  )}
                </Space>
              )
            },
          },
        ]
      : []),
  ]

  return (
    <>
      <Table dataSource={transfers} columns={columns} rowKey="id" pagination={{ pageSize: 20 }} size="small" />
      <Modal
        open={!!disputeId}
        title="ร้องขอ — ของยังไม่ถึง"
        onOk={submitDispute}
        onCancel={() => { setDisputeId(null); setDisputeMsg('') }}
        confirmLoading={actionLoading}
        okText="ยืนยัน"
        cancelText="ยกเลิก"
      >
        <Input.TextArea
          rows={3}
          placeholder="ระบุรายละเอียดที่ยังไม่ได้รับ"
          value={disputeMsg}
          onChange={e => setDisputeMsg(e.target.value)}
        />
      </Modal>
    </>
  )
}
```

- [ ] **Step 3: Create src/app/stock/transfers/new/page.tsx**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Form, Select, Button, Card, Typography, Alert, DatePicker,
  InputNumber, Space, Divider,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'

const { Title } = Typography

interface Shop { id: string; name: string }
interface StockItem { id: string; name: string; unit: string; availableQty: number }
interface PartRow { stockItemId: string; quantity: number }

export default function NewTransferPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [parts, setParts] = useState<PartRow[]>([{ stockItemId: '', quantity: 1 }])

  useEffect(() => {
    fetch('/api/admin/shops').then(r => r.json()).then(setShops)
    fetch('/api/stock').then(r => r.json()).then(setStockItems)
  }, [])

  function updatePart(index: number, field: keyof PartRow, value: string | number) {
    setParts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  function removePart(index: number) {
    setParts(prev => prev.filter((_, i) => i !== index))
  }

  async function onFinish(values: { toShopId: string; deliveryDate: import('dayjs').Dayjs }) {
    const validParts = parts.filter(p => p.stockItemId && p.quantity > 0)
    if (validParts.length === 0) {
      setError('กรุณาเลือกอะไหล่อย่างน้อย 1 รายการ')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stock/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toShopId: values.toShopId,
          deliveryDate: values.deliveryDate.toISOString(),
          items: validParts,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/stock/transfers')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 640 }}>
      <Title level={4}>โอนอะไหล่ไปสาขา</Title>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="สาขาปลายทาง" name="toShopId" rules={[{ required: true, message: 'กรุณาเลือกปลายทาง' }]}>
            <Select
              placeholder="เลือกสาขา"
              options={shops.map(s => ({ label: s.name, value: s.id }))}
            />
          </Form.Item>
          <Form.Item label="วันที่คาดว่าของจะถึง" name="deliveryDate" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Divider orientation="left">รายการอะไหล่</Divider>
          {parts.map((part, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 32px', gap: 8, marginBottom: 8 }}>
              <Select
                placeholder="เลือกอะไหล่"
                value={part.stockItemId || undefined}
                onChange={v => updatePart(index, 'stockItemId', v)}
                options={stockItems.map(s => ({
                  label: `${s.name} (พร้อมใช้ ${s.availableQty} ${s.unit})`,
                  value: s.id,
                }))}
              />
              <InputNumber
                min={1}
                value={part.quantity}
                onChange={v => updatePart(index, 'quantity', v ?? 1)}
                style={{ width: '100%' }}
              />
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => removePart(index)}
                disabled={parts.length === 1}
              />
            </div>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setParts(prev => [...prev, { stockItemId: '', quantity: 1 }])}
            style={{ marginBottom: 16 }}
          >
            เพิ่มรายการ
          </Button>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => router.back()}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={loading}>สร้างคำสั่งโอน</Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/stock/transfers/
git commit -m "feat: add stock transfers list and new transfer pages"
```

---

## Task 10: Update Job Intake Form — 6 Steps

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace src/app/page.tsx**

แทนที่ทั้งไฟล์:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Form, Steps, Button, Input, DatePicker, TimePicker,
  InputNumber, Select, Checkbox, Upload, message, Card, Typography, Divider,
} from 'antd'
import { InboxOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Dragger } = Upload
const { Title } = Typography

const SYMPTOMS = [
  'ระบบเครื่องยนต์',
  'ระบบส่งกำลัง',
  'ระบบช่วงล่าง',
  'ระบบปรับอากาศ',
  'ระบบเบรค',
]

const STATUSES = [
  'ลูกค้าอนุมัติซ่อมแล้ว',
  'อยู่ระหว่างดำเนินการ',
  'ซ่อมเสร็จเรียบร้อยแล้ว',
  'ส่งมอบและเก็บเงินแล้ว',
  'ยกเลิกรายการแล้ว',
]

const STEP_REQUIRED_FIELDS: string[][] = [
  ['date', 'time'],
  ['customerName', 'phone', 'licensePlate', 'odometer'],
  [],
  ['cause', 'totalPrice', 'status'],
  [],
  [],
]

interface Tech { id: string; name: string; role: string }
interface StockItemOption { id: string; name: string; unit: string; availableQty: number; category: string }
interface PartRow { stockItemId: string; quantity: number }

export default function IntakeFormPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [step, setStep] = useState(0)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [loading, setLoading] = useState(false)
  const [techs, setTechs] = useState<Tech[]>([])
  const [stockItems, setStockItems] = useState<StockItemOption[]>([])
  const [parts, setParts] = useState<PartRow[]>([])

  useEffect(() => {
    fetch('/api/users/techs').then(r => r.json()).then(setTechs).catch(() => {})
  }, [])

  // Lazy-load stock items when user reaches step 4
  useEffect(() => {
    if (step === 4 && stockItems.length === 0) {
      fetch('/api/stock?available=true')
        .then(r => r.json())
        .then(setStockItems)
        .catch(() => {})
    }
  }, [step, stockItems.length])

  const goNext = async () => {
    try {
      if (STEP_REQUIRED_FIELDS[step].length > 0) {
        await form.validateFields(STEP_REQUIRED_FIELDS[step])
      }
      setStep(s => s + 1)
    } catch { /* validation error shown by Ant Design */ }
  }

  const goPrev = () => setStep(s => s - 1)

  function updatePart(index: number, field: keyof PartRow, value: string | number) {
    setParts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  function removePart(index: number) {
    setParts(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const values = form.getFieldsValue(true)

      const validParts = parts.filter(p => p.stockItemId && p.quantity > 0)

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
        assignedTo:   values.assignedTo || null,
        parts:        validParts,
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

      if (fileList.length > 0) {
        const fd = new FormData()
        fileList.forEach(f => { if (f.originFileObj) fd.append('images', f.originFileObj) })
        const imgRes = await fetch(`/api/jobs/${id}/images`, { method: 'POST', body: fd })
        if (!imgRes.ok) message.warning('บันทึกงานแล้ว แต่อัปโหลดรูปภาพไม่สำเร็จ')
      }

      router.push(`/receipt/${id}`)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  const STEP_LABELS = ['1. เบื้องต้น', '2. ลูกค้า/รถ', '3. อาการ', '4. ผลและราคา', '5. อะไหล่', '6. รูปภาพ']

  return (
    <div style={{ minHeight: 'calc(100vh - 48px)', background: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '32px 16px' }}>
      <Card style={{ width: '100%', maxWidth: 560, borderRadius: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.06)' }}>

        <Steps
          current={step}
          size="small"
          style={{ marginBottom: 28 }}
          items={[
            { title: 'เบื้องต้น' },
            { title: 'ลูกค้า/รถ' },
            { title: 'อาการ' },
            { title: 'ผล/ราคา' },
            { title: 'อะไหล่' },
            { title: 'รูปภาพ' },
          ]}
        />

        <Form form={form} layout="vertical" requiredMark={false}>

          {/* ── Step 1: Basic Info + Technician ─────────────── */}
          <div style={{ display: step === 0 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 20 }}>
              {STEP_LABELS[0]}
            </Title>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="date" label="วันที่รับรถ" rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}>
                <DatePicker style={{ width: '100%' }} placeholder="เลือกวันที่" />
              </Form.Item>
              <Form.Item name="time" label="เวลา" rules={[{ required: true, message: 'กรุณาเลือกเวลา' }]}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" placeholder="เลือกเวลา" />
              </Form.Item>
            </div>
            <Form.Item name="assignedTo" label="ช่างที่รับงาน (ไม่บังคับ)">
              <Select
                allowClear
                placeholder="เลือกช่าง"
                options={techs.map(t => ({ label: t.name, value: t.id }))}
              />
            </Form.Item>
          </div>

          {/* ── Step 2: Customer & Vehicle ───────────────────── */}
          <div style={{ display: step === 1 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 20 }}>
              {STEP_LABELS[1]}
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
              {STEP_LABELS[2]}
            </Title>
            <Form.Item name="symptoms" label="เลือกระบบที่มีปัญหา">
              <Checkbox.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SYMPTOMS.map(s => (
                  <Checkbox
                    key={s}
                    value={s}
                    style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: 8, marginInlineStart: 0, width: '100%' }}
                  >
                    {s}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </Form.Item>
            <Form.Item name="notes" label="รายละเอียดเพิ่มเติม">
              <TextArea rows={2} placeholder="อาการอื่น ๆ ที่ลูกค้าแจ้ง" />
            </Form.Item>
            <div style={{ background: '#fff7ed', border: '1px dashed #f97316', padding: '12px 16px', borderRadius: 8, fontSize: '0.875rem', color: '#9a3412', fontStyle: 'italic' }}>
              <strong>ธุรการพูด:</strong> "เดี๋ยวช่างนัทจะเช็คอย่างละเอียดและโทรแจ้งราคาก่อนซ่อมนะคะ"
            </div>
          </div>

          {/* ── Step 4: Result & Price ───────────────────────── */}
          <div style={{ display: step === 3 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 20 }}>
              {STEP_LABELS[3]}
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

          {/* ── Step 5: Parts ────────────────────────────────── */}
          <div style={{ display: step === 4 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 8 }}>
              {STEP_LABELS[4]}
            </Title>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 16 }}>
              เลือกอะไหล่จากคลังที่ใช้ในงานนี้ (ไม่บังคับ)
            </p>
            {parts.map((part, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 32px', gap: 8, marginBottom: 8 }}>
                <Select
                  placeholder="เลือกอะไหล่"
                  value={part.stockItemId || undefined}
                  onChange={v => updatePart(index, 'stockItemId', v)}
                  options={stockItems.map(s => ({
                    label: `${s.name} (${s.category}) — พร้อมใช้ ${s.availableQty} ${s.unit}`,
                    value: s.id,
                  }))}
                />
                <InputNumber
                  min={1}
                  max={stockItems.find(s => s.id === part.stockItemId)?.availableQty ?? 9999}
                  value={part.quantity}
                  onChange={v => updatePart(index, 'quantity', v ?? 1)}
                  style={{ width: '100%' }}
                />
                <Button danger icon={<DeleteOutlined />} onClick={() => removePart(index)} />
              </div>
            ))}
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => setParts(prev => [...prev, { stockItemId: '', quantity: 1 }])}
              block
            >
              เพิ่มอะไหล่
            </Button>
          </div>

          {/* ── Step 6: Image Upload ─────────────────────────── */}
          <div style={{ display: step === 5 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 20 }}>
              {STEP_LABELS[5]}
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

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
          {step > 0 ? (
            <Button onClick={goPrev} disabled={loading}>กลับ</Button>
          ) : (
            <div />
          )}
          {step < 5 ? (
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
git commit -m "feat: update job intake form to 6 steps with assignedTo and parts"
```

---

## Task 11: Update Edit Job Page

**Files:**
- Modify: `src/app/edit/[id]/page.tsx`

- [ ] **Step 1: Replace src/app/edit/[id]/page.tsx**

แทนที่ทั้งไฟล์:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Form, Input, InputNumber, Select, Checkbox,
  DatePicker, TimePicker, Button, Typography,
  Space, Divider, message, Spin, Card, Tag, Alert,
} from 'antd'
import { SaveOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input

const SYMPTOMS = [
  'ระบบเครื่องยนต์', 'ระบบส่งกำลัง', 'ระบบช่วงล่าง', 'ระบบปรับอากาศ', 'ระบบเบรค',
]

const STATUSES = [
  'ลูกค้าอนุมัติซ่อมแล้ว',
  'อยู่ระหว่างดำเนินการ',
  'ซ่อมเสร็จเรียบร้อยแล้ว',
  'ส่งมอบและเก็บเงินแล้ว',
  'ยกเลิกรายการแล้ว',
]

interface Tech { id: string; name: string }
interface StockItem { id: string; name: string; unit: string; availableQty: number; category: string }
interface PartRow { stockItemId: string; quantity: number; stockItem?: { name: string; unit: string } }

export default function EditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [jobNo, setJobNo]       = useState('')
  const [stockStatus, setStockStatus] = useState<string>('none')
  const [techs, setTechs]       = useState<Tech[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [parts, setParts]       = useState<PartRow[]>([])

  useEffect(() => {
    Promise.all([
      fetch(`/api/jobs/${id}`).then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/users/techs').then(r => r.json()),
      fetch('/api/stock?available=true').then(r => r.json()),
    ])
      .then(([job, techList, stockList]) => {
        setJobNo(job.jobNo)
        setStockStatus(job.stockStatus ?? 'none')
        setTechs(techList)
        setStockItems(stockList)
        setParts(job.jobParts ?? [])
        form.setFieldsValue({
          date:         dayjs(job.date, 'YYYY-MM-DD'),
          time:         dayjs(job.time, 'HH:mm'),
          customerName: job.customerName,
          phone:        job.phone,
          licensePlate: job.licensePlate,
          odometer:     job.odometer,
          symptoms:     job.symptoms,
          notes:        job.notes ?? '',
          cause:        job.cause,
          totalPrice:   job.totalPrice,
          status:       job.status,
          assignedTo:   job.assignedTo ?? undefined,
        })
      })
      .catch(() => message.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [id, form])

  function updatePart(index: number, field: keyof PartRow, value: string | number) {
    setParts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  const onFinish = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      const validParts = parts.filter(p => p.stockItemId && p.quantity > 0)
      const payload: Record<string, unknown> = {
        date:         (values.date as dayjs.Dayjs).format('YYYY-MM-DD'),
        time:         (values.time as dayjs.Dayjs).format('HH:mm'),
        customerName: values.customerName,
        phone:        values.phone,
        licensePlate: values.licensePlate,
        odometer:     values.odometer,
        symptoms:     values.symptoms ?? [],
        notes:        values.notes || null,
        cause:        values.cause,
        totalPrice:   values.totalPrice,
        status:       values.status,
        assignedTo:   values.assignedTo || null,
      }

      // Only send parts if still editable
      if (stockStatus === 'none') {
        payload.parts = validParts.map(p => ({ stockItemId: p.stockItemId, quantity: p.quantity }))
      }

      const res = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('save failed')
      message.success('บันทึกเรียบร้อยแล้ว')
      router.push(`/receipt/${id}`)
    } catch {
      message.error('บันทึกไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  const partsLocked = stockStatus !== 'none'

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>กลับ</Button>
      </Space>

      <Card>
        <Title level={4} style={{ marginBottom: 4 }}>✏️ แก้ไขใบงาน</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          เลขที่ใบงาน: <strong>{jobNo}</strong>
        </Text>

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Divider orientation="left" style={{ fontWeight: 600 }}>ข้อมูลเบื้องต้น</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="date" label="วันที่รับรถ" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="time" label="เวลา" rules={[{ required: true }]}>
              <TimePicker style={{ width: '100%' }} format="HH:mm" />
            </Form.Item>
          </div>
          <Form.Item name="assignedTo" label="ช่างที่รับงาน">
            <Select
              allowClear
              placeholder="เลือกช่าง"
              options={techs.map(t => ({ label: t.name, value: t.id }))}
            />
          </Form.Item>

          <Divider orientation="left" style={{ fontWeight: 600 }}>ข้อมูลลูกค้าและรถ</Divider>
          <Form.Item name="customerName" label="ชื่อ-นามสกุล" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="เบอร์โทรศัพท์" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="licensePlate" label="ทะเบียนรถ" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="odometer" label="เลขไมล์ (KM)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </div>

          <Divider orientation="left" style={{ fontWeight: 600 }}>อาการที่แจ้ง</Divider>
          <Form.Item name="symptoms" label="อาการ">
            <Checkbox.Group options={SYMPTOMS} style={{ display: 'flex', flexDirection: 'column', gap: 8 }} />
          </Form.Item>
          <Form.Item name="notes" label="รายละเอียดเพิ่มเติม">
            <TextArea rows={2} />
          </Form.Item>

          <Divider orientation="left" style={{ fontWeight: 600 }}>บันทึกผลและราคา</Divider>
          <Form.Item name="cause" label="สาเหตุที่พบ / อะไหล่" rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="totalPrice" label="สรุปราคาสุทธิ (บาท)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="status" label="สถานะ" rules={[{ required: true }]}>
              <Select options={STATUSES.map(s => ({ label: s, value: s }))} />
            </Form.Item>
          </div>

          <Divider orientation="left" style={{ fontWeight: 600 }}>
            อะไหล่
            {partsLocked && (
              <Tag color="orange" style={{ marginLeft: 8, fontWeight: 400 }}>
                ล็อค — stockStatus: {stockStatus}
              </Tag>
            )}
          </Divider>
          {partsLocked ? (
            parts.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                {parts.map((p, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    {p.stockItem?.name ?? p.stockItemId} × {p.quantity} {p.stockItem?.unit ?? ''}
                  </div>
                ))}
              </div>
            ) : (
              <Alert message="ไม่มีอะไหล่ในงานนี้" type="info" style={{ marginBottom: 16 }} />
            )
          ) : (
            <>
              {parts.map((part, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 32px', gap: 8, marginBottom: 8 }}>
                  <Select
                    placeholder="เลือกอะไหล่"
                    value={part.stockItemId || undefined}
                    onChange={v => updatePart(index, 'stockItemId', v)}
                    options={stockItems.map(s => ({
                      label: `${s.name} (${s.category}) — พร้อมใช้ ${s.availableQty} ${s.unit}`,
                      value: s.id,
                    }))}
                  />
                  <InputNumber
                    min={1}
                    value={part.quantity}
                    onChange={v => updatePart(index, 'quantity', v ?? 1)}
                    style={{ width: '100%' }}
                  />
                  <Button danger icon={<DeleteOutlined />} onClick={() => setParts(prev => prev.filter((_, i) => i !== index))} />
                </div>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => setParts(prev => [...prev, { stockItemId: '', quantity: 1 }])}
                style={{ marginBottom: 16 }}
                block
              >
                เพิ่มอะไหล่
              </Button>
            </>
          )}

          <Divider />
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large">
                บันทึกการแก้ไข
              </Button>
              <Button size="large" onClick={() => router.push(`/receipt/${id}`)}>ยกเลิก</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/edit/"
git commit -m "feat: update edit job page with assignedTo, new statuses, parts section"
```

---

## Task 12: Navigation + Middleware

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/middleware.ts`

- [ ] **Step 1: Add คลังอะไหล่ link to src/app/layout.tsx**

เพิ่ม nav link หลังจาก analytics link. ในส่วน `{user && (` → `<nav>` ค้นหาบรรทัดที่มี `วิเคราะห์ข้อมูล` แล้วเพิ่มต่อไปนี้ **หลัง** closing `)}` ของ analytics block:

```typescript
{(user.role === 'SUPER_ADMIN' || user.role === 'SHOP_ADMIN' || user.role === 'LEAD_TECH') && (
  <Link href="/stock" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
    คลังอะไหล่
  </Link>
)}
```

- [ ] **Step 2: Add /stock protection for TECH in src/middleware.ts**

เพิ่มก่อน `return NextResponse.next()` ท้ายสุด:

```typescript
// ── /stock → not TECH ─────────────────────────────────────────────────────
if (pathname.startsWith('/stock') && role === 'TECH') {
  return NextResponse.redirect(new URL('/', req.url))
}
```

- [ ] **Step 3: Build ตรวจสอบ TypeScript**

```bash
npm run build 2>&1 | grep -E "error TS" | head -10
```

Expected: ไม่มี TypeScript error

- [ ] **Step 4: ทดสอบ full flow**

```
1. Login เป็น SHOP_ADMIN → เห็น "คลังอะไหล่" ใน nav
2. ไป /stock → เห็นหน้าคลังอะไหล่ (ว่าง)
3. เพิ่มอะไหล่ใหม่ที่ /stock/new → กลับมาเห็นในตาราง
4. กด "ปรับยอด" → เพิ่ม 10 ชิ้น
5. สร้างงานใหม่ → step 5 อะไหล่ → เลือกอะไหล่ที่สร้าง → บันทึก
6. เข้า /edit/[id] → เห็น parts section ที่แก้ไขได้ (stockStatus = none)
7. เปลี่ยนสถานะงานเป็น "อยู่ระหว่างดำเนินการ" → PATCH → ตรวจสอบ reserved +qty ใน /stock
8. Login เป็น TECH → /stock redirect กลับ /
```

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/middleware.ts
git commit -m "feat: add คลังอะไหล่ nav link, block TECH from /stock"
```

---

## Self-Review

**Spec coverage:**
- ✅ Section 1 (DB Schema) → Task 1
- ✅ Section 2 (Job Statuses) → Task 10, 11 (STATUSES array updated in both files)
- ✅ Section 3 (Stock Deduction Logic) → Task 6
- ✅ Section 4 (Transfer Logic) → Task 3
- ✅ Section 5 (Job Form 6 Steps) → Task 10; Edit page → Task 11
- ✅ Section 6 (Stock Pages) → Tasks 7, 8, 9
- ✅ Section 7 (API Routes) → Tasks 2, 3, 4, 5, 6
- ✅ Section 8 (RBAC) → enforced in each API + middleware
- ✅ Section 9 (Migration) → Task 1

**Type consistency check:**
- `PartRow.stockItemId` / `quantity` used consistently across page.tsx, edit/[id]/page.tsx, API routes
- `StockAdjustLog.reason` format `"job:<id>"` and `"transfer:<id>"` consistent in Task 3 and Task 6
- `stockStatus` values `"none"` | `"reserved"` | `"deducted"` consistent across all files
- `TransferStatus` enum values match between schema and API PATCH handler
