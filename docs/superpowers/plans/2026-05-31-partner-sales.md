# Phase 2B: Partner Sales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มระบบขายอะไหล่ให้พันธมิตร (ร้านภายนอก) — PARTNER_SALE transfer flow พร้อม approval workflow และหน้าจัดการพันธมิตร

**Architecture:** เพิ่ม `ShopPartner` model (many-to-many, bidirectional 2 rows) สำหรับความสัมพันธ์พันธมิตร. PARTNER_SALE transfer เริ่มด้วย `status = PENDING` รอผู้ซื้อ (destination) อนุมัติ → `IN_TRANSIT` + soft reserve / `REJECTED`. ปลายทางยืนยันรับ → `DELIVERED` ตัดสต็อก. UI ใช้ tabs แยก BRANCH | PARTNER_SALE ใน transfers page.

**Tech Stack:** Next.js 14 App Router, Prisma (PostgreSQL), Ant Design 5, Auth.js v5

---

## File Map

**สร้างใหม่:**
- `prisma/migrations/.../migration.sql` — add ShopPartner table (auto-generated)
- `src/app/api/admin/partners/route.ts` — GET list + POST add partnership
- `src/app/api/admin/partners/[id]/route.ts` — DELETE remove partnership
- `src/app/admin/partners/page.tsx` — partner management server page
- `src/app/admin/partners/PartnersTable.tsx` — partner management client component

**แก้ไข:**
- `prisma/schema.prisma` — add ShopPartner model + Shop relations
- `src/app/api/stock/transfers/route.ts` — POST: handle type param (BRANCH/PARTNER_SALE), unitPrice, partner validation, PENDING start
- `src/app/api/stock/transfers/[id]/route.ts` — PATCH: add IN_TRANSIT from PENDING (approve), REJECTED from PENDING
- `src/app/stock/transfers/page.tsx` — pass shopId to client for role-checking
- `src/app/stock/transfers/TransfersTable.tsx` — add tabs, PARTNER_SALE columns, approve/reject buttons
- `src/app/stock/transfers/new/page.tsx` — add type selector, partner list, unitPrice field
- `src/app/layout.tsx` — add จัดการพันธมิตร nav link for SUPER_ADMIN

---

## Task 1: Prisma Schema — ShopPartner Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add ShopPartner model and Shop relations**

เพิ่ม model ใหม่ต่อท้าย `prisma/schema.prisma`:

```prisma
model ShopPartner {
  id        String   @id @default(cuid())
  shopId    String
  partnerId String
  shop      Shop     @relation("ShopPartners", fields: [shopId], references: [id])
  partner   Shop     @relation("PartnerShops", fields: [partnerId], references: [id])
  createdAt DateTime @default(now())

  @@unique([shopId, partnerId])
  @@index([shopId])
}
```

เพิ่มใน `model Shop` (หลัง `transfersTo` relation):

```prisma
  shopPartners  ShopPartner[] @relation("ShopPartners")
  partnerOf     ShopPartner[] @relation("PartnerShops")
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/tae/Desktop/playground/ddcar
npx prisma migrate dev --name add-shop-partner
```

Expected: สร้าง migration file ใหม่, ไม่มี error

- [ ] **Step 3: Verify generate**

```bash
npx prisma generate
```

Expected: ✔ Generated Prisma Client

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add ShopPartner model for partner relationships"
```

---

## Task 2: Partner Management API

**Files:**
- Create: `src/app/api/admin/partners/route.ts`
- Create: `src/app/api/admin/partners/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/admin/partners/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId } = session.user
    if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (role === 'SUPER_ADMIN') {
      // Return unique pairs (deduplicated: shopId < partnerId lexicographically)
      const records = await prisma.shopPartner.findMany({
        include: {
          shop:    { select: { id: true, name: true } },
          partner: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      })
      return Response.json(records.filter(r => r.shopId < r.partnerId))
    }

    // SHOP_ADMIN: own partners only
    const records = await prisma.shopPartner.findMany({
      where: { shopId },
      include: { partner: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return Response.json(records)
  } catch (err) {
    console.error('[GET /api/admin/partners]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (session.user.role !== 'SUPER_ADMIN') {
      return Response.json({ error: 'Forbidden — SUPER_ADMIN only' }, { status: 403 })
    }

    const { shopAId, shopBId } = await req.json()
    if (!shopAId || !shopBId || shopAId === shopBId) {
      return Response.json({ error: 'กรุณาเลือกร้านสองร้านที่ต่างกัน' }, { status: 422 })
    }

    // Verify both shops exist
    const count = await prisma.shop.count({ where: { id: { in: [shopAId, shopBId] } } })
    if (count !== 2) return Response.json({ error: 'ไม่พบร้านที่เลือก' }, { status: 422 })

    // Check existing
    const existing = await prisma.shopPartner.findUnique({
      where: { shopId_partnerId: { shopId: shopAId, partnerId: shopBId } },
    })
    if (existing) return Response.json({ error: 'เป็นพันธมิตรกันอยู่แล้ว' }, { status: 422 })

    // Insert both directions
    await prisma.$transaction([
      prisma.shopPartner.create({ data: { shopId: shopAId, partnerId: shopBId } }),
      prisma.shopPartner.create({ data: { shopId: shopBId, partnerId: shopAId } }),
    ])

    return Response.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/partners]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `src/app/api/admin/partners/[id]/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'SUPER_ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const record = await prisma.shopPartner.findUnique({ where: { id: params.id } })
    if (!record) return Response.json({ error: 'Not found' }, { status: 404 })

    // Delete both directions
    await prisma.$transaction([
      prisma.shopPartner.delete({ where: { id: record.id } }),
      prisma.shopPartner.deleteMany({
        where: { shopId: record.partnerId, partnerId: record.shopId },
      }),
    ])

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/admin/partners/[id]]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/tae/Desktop/playground/ddcar && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/partners/
git commit -m "feat: add partner management API (list, add, remove)"
```

---

## Task 3: Partner Admin Page + Nav Link

**Files:**
- Create: `src/app/admin/partners/page.tsx`
- Create: `src/app/admin/partners/PartnersTable.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/app/admin/partners/page.tsx`**

```typescript
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PartnersTable from './PartnersTable'

export default async function PartnersPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.role !== 'SUPER_ADMIN') redirect('/')

  const records = await prisma.shopPartner.findMany({
    include: {
      shop:    { select: { id: true, name: true } },
      partner: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  const pairs = records.filter(r => r.shopId < r.partnerId)

  const shops = await prisma.shop.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return <PartnersTable pairs={pairs} shops={shops} />
}
```

- [ ] **Step 2: Create `src/app/admin/partners/PartnersTable.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { Table, Button, Select, Space, Modal, message, Typography, Popconfirm } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

const { Title } = Typography

interface Shop { id: string; name: string }
interface Pair {
  id: string
  shop:    { id: string; name: string }
  partner: { id: string; name: string }
}

interface Props {
  pairs: Pair[]
  shops: Shop[]
}

export default function PartnersTable({ pairs: initialPairs, shops }: Props) {
  const [pairs, setPairs] = useState(initialPairs)
  const [open, setOpen] = useState(false)
  const [shopAId, setShopAId] = useState<string | undefined>()
  const [shopBId, setShopBId] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

  async function addPartner() {
    if (!shopAId || !shopBId) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopAId, shopBId }),
      })
      const data = await res.json()
      if (!res.ok) { message.error(data.error); return }
      message.success('เพิ่มพันธมิตรสำเร็จ')
      setOpen(false)
      setShopAId(undefined)
      setShopBId(undefined)
      window.location.reload()
    } finally {
      setSaving(false)
    }
  }

  async function removePartner(id: string) {
    try {
      const res = await fetch(`/api/admin/partners/${id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); message.error(d.error); return }
      message.success('ลบพันธมิตรสำเร็จ')
      setPairs(prev => prev.filter(p => p.id !== id))
    } catch {
      message.error('เกิดข้อผิดพลาด')
    }
  }

  const columns = [
    {
      title: 'ร้าน A',
      key: 'shopA',
      render: (_: unknown, r: Pair) => r.shop.name,
    },
    {
      title: 'ร้าน B',
      key: 'shopB',
      render: (_: unknown, r: Pair) => r.partner.name,
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, r: Pair) => (
        <Popconfirm
          title="ยืนยันลบพันธมิตร?"
          onConfirm={() => removePartner(r.id)}
          okText="ลบ"
          cancelText="ยกเลิก"
        >
          <Button size="small" danger>ลบ</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>จัดการพันธมิตร</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          เพิ่มพันธมิตร
        </Button>
      </div>

      <Table dataSource={pairs} columns={columns} rowKey="id" pagination={false} size="small" />

      <Modal
        open={open}
        title="เพิ่มความสัมพันธ์พันธมิตร"
        onOk={addPartner}
        onCancel={() => { setOpen(false); setShopAId(undefined); setShopBId(undefined) }}
        confirmLoading={saving}
        okText="เพิ่ม"
        cancelText="ยกเลิก"
        okButtonProps={{ disabled: !shopAId || !shopBId || shopAId === shopBId }}
      >
        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size="middle">
          <div>
            <div style={{ marginBottom: 4 }}>ร้าน A</div>
            <Select
              style={{ width: '100%' }}
              placeholder="เลือกร้าน"
              value={shopAId}
              onChange={setShopAId}
              options={shops.map(s => ({ label: s.name, value: s.id }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>ร้าน B</div>
            <Select
              style={{ width: '100%' }}
              placeholder="เลือกร้าน"
              value={shopBId}
              onChange={setShopBId}
              options={shops.filter(s => s.id !== shopAId).map(s => ({ label: s.name, value: s.id }))}
            />
          </div>
        </Space>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 3: Add nav link in `src/app/layout.tsx`**

หา block ที่มี `จัดการผู้ใช้` แล้วเพิ่ม block ต่อไปนี้ **หลัง** closing `)}` ของ users link:

```typescript
{user.role === 'SUPER_ADMIN' && (
  <Link href="/admin/partners" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
    จัดการพันธมิตร
  </Link>
)}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/tae/Desktop/playground/ddcar && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/partners/ src/app/layout.tsx
git commit -m "feat: add partner management page and nav link"
```

---

## Task 4: Update Transfers API for PARTNER_SALE

**Files:**
- Modify: `src/app/api/stock/transfers/route.ts`
- Modify: `src/app/api/stock/transfers/[id]/route.ts`

**Flow:**
- BRANCH (unchanged): source creates → `IN_TRANSIT` immediately, reserve stock
- PARTNER_SALE (new): source creates → `PENDING`, no stock impact; destination approves → `IN_TRANSIT`, reserve stock; destination rejects → `REJECTED`

- [ ] **Step 1: Update POST in `src/app/api/stock/transfers/route.ts`**

Read the current file. แทนที่ทั้ง `POST` handler:

```typescript
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId, id: userId } = session.user
    if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { toShopId, deliveryDate, note, items, type = 'BRANCH', unitPrice } = body

    if (!toShopId || !deliveryDate || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 422 })
    }
    if (toShopId === shopId) {
      return Response.json({ error: 'ปลายทางต้องไม่ใช่ร้านตัวเอง' }, { status: 422 })
    }
    if (type !== 'BRANCH' && type !== 'PARTNER_SALE') {
      return Response.json({ error: 'type ต้องเป็น BRANCH หรือ PARTNER_SALE' }, { status: 422 })
    }

    // PARTNER_SALE: unitPrice required + validate partner relationship
    if (type === 'PARTNER_SALE') {
      const numPrice = Number(unitPrice)
      if (!Number.isFinite(numPrice) || numPrice <= 0) {
        return Response.json({ error: 'PARTNER_SALE ต้องระบุราคาต่อหน่วย (unitPrice > 0)' }, { status: 422 })
      }
      const partner = await prisma.shopPartner.findUnique({
        where: { shopId_partnerId: { shopId, partnerId: toShopId } },
      })
      if (!partner) {
        return Response.json({ error: 'ร้านนี้ไม่ใช่พันธมิตรของท่าน' }, { status: 422 })
      }
    }

    const deliveryDateObj = new Date(deliveryDate)
    if (isNaN(deliveryDateObj.getTime())) {
      return Response.json({ error: 'วันที่ส่งถึงไม่ถูกต้อง' }, { status: 422 })
    }

    // Validate quantities
    for (const item of items) {
      const qty = Number(item.quantity)
      if (!Number.isFinite(qty) || qty <= 0) {
        return Response.json({ error: 'จำนวนต้องเป็นตัวเลขที่มากกว่า 0' }, { status: 422 })
      }
    }

    // Validate stock items belong to fromShop
    const stockIds = items.map((i: { stockItemId: string }) => i.stockItemId)
    const stockItems = await prisma.stockItem.findMany({
      where: { id: { in: stockIds }, shopId },
    })
    if (stockItems.length !== stockIds.length) {
      return Response.json({ error: 'อะไหล่บางรายการไม่พบในร้านนี้' }, { status: 422 })
    }

    // BRANCH: start IN_TRANSIT with immediate soft reserve
    // PARTNER_SALE: start PENDING, no stock impact
    const initialStatus = type === 'BRANCH' ? 'IN_TRANSIT' : 'PENDING'

    let transfer
    try {
      transfer = await prisma.$transaction(async (tx) => {
        if (type === 'BRANCH') {
          // Check availability inside transaction
          for (const item of items as { stockItemId: string; quantity: number }[]) {
            const current = await tx.stockItem.findUnique({ where: { id: item.stockItemId } })
            if (!current) throw Object.assign(new Error('Not found'), { status: 404 })
            const available = current.quantity - current.reserved
            if (available < item.quantity) {
              throw Object.assign(
                new Error(`อะไหล่ "${current.name}" มีพร้อมใช้เพียง ${available} ${current.unit}`),
                { status: 422 }
              )
            }
          }
        }

        const created = await tx.stockTransfer.create({
          data: {
            type,
            fromShopId: shopId,
            toShopId,
            status: initialStatus,
            deliveryDate: deliveryDateObj,
            note: note || null,
            requestedBy: userId,
            unitPrice: type === 'PARTNER_SALE' ? Number(unitPrice) : null,
            items: {
              create: items.map((i: { stockItemId: string; quantity: number }) => ({
                stockItemId: i.stockItemId,
                quantity: i.quantity,
              })),
            },
          },
          include: { items: true },
        })

        if (type === 'BRANCH') {
          for (const item of items as { stockItemId: string; quantity: number }[]) {
            await tx.stockItem.update({
              where: { id: item.stockItemId },
              data: { reserved: { increment: item.quantity } },
            })
          }
        }

        return created
      })
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e.status === 404) return Response.json({ error: 'Not found' }, { status: 404 })
      if (e.status === 422) return Response.json({ error: e.message }, { status: 422 })
      throw err
    }

    return Response.json(transfer, { status: 201 })
  } catch (err) {
    console.error('[POST /api/stock/transfers]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Update PATCH in `src/app/api/stock/transfers/[id]/route.ts`**

Read the current file. แทนที่ทั้ง `PATCH` handler ด้วยเวอร์ชันใหม่ที่เพิ่ม `IN_TRANSIT` from PENDING และ `REJECTED` states:

```typescript
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId, id: userId } = session.user
    if (role === 'TECH') return Response.json({ error: 'Forbidden' }, { status: 403 })

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: params.id },
      include: { items: { include: { stockItem: true } } },
    })
    if (!transfer) return Response.json({ error: 'Not found' }, { status: 404 })

    // Verify caller belongs to this transfer
    if (transfer.fromShopId !== shopId && transfer.toShopId !== shopId) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json()
    const { status } = body

    // ── PARTNER_SALE: destination approves → IN_TRANSIT ─────────────────────
    if (status === 'IN_TRANSIT' && transfer.type === 'PARTNER_SALE') {
      if (transfer.toShopId !== shopId) {
        return Response.json({ error: 'เฉพาะผู้ซื้อ (ปลายทาง) เท่านั้นที่อนุมัติได้' }, { status: 403 })
      }
      if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transfer.status !== 'PENDING') {
        return Response.json({ error: 'อนุมัติได้เฉพาะ status PENDING เท่านั้น' }, { status: 422 })
      }

      try {
        await prisma.$transaction(async (tx) => {
          await tx.stockTransfer.update({
            where: { id: params.id },
            data: { status: 'IN_TRANSIT' },
          })
          // Soft reserve source stock
          for (const item of transfer.items) {
            const current = await tx.stockItem.findUnique({ where: { id: item.stockItemId } })
            if (!current || current.quantity - current.reserved < item.quantity) {
              throw Object.assign(
                new Error(`อะไหล่ "${item.stockItem.name}" มีไม่พอสำหรับการอนุมัติ`),
                { status: 422 }
              )
            }
            await tx.stockItem.update({
              where: { id: item.stockItemId },
              data: { reserved: { increment: item.quantity } },
            })
          }
        })
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string }
        if (e.status === 422) return Response.json({ error: e.message }, { status: 422 })
        throw err
      }

      return Response.json({ ok: true })
    }

    // ── PARTNER_SALE: destination rejects → REJECTED ─────────────────────────
    if (status === 'REJECTED') {
      if (transfer.type !== 'PARTNER_SALE') {
        return Response.json({ error: 'REJECTED ใช้ได้เฉพาะ PARTNER_SALE เท่านั้น' }, { status: 422 })
      }
      if (transfer.toShopId !== shopId) {
        return Response.json({ error: 'เฉพาะผู้ซื้อ (ปลายทาง) เท่านั้นที่ปฏิเสธได้' }, { status: 403 })
      }
      if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transfer.status !== 'PENDING') {
        return Response.json({ error: 'ปฏิเสธได้เฉพาะ status PENDING เท่านั้น' }, { status: 422 })
      }

      await prisma.stockTransfer.update({
        where: { id: params.id },
        data: { status: 'REJECTED' },
      })

      return Response.json({ ok: true })
    }

    // ── DELIVERED: destination confirms receipt ───────────────────────────────
    if (status === 'DELIVERED') {
      if (transfer.toShopId !== shopId) {
        return Response.json({ error: 'เฉพาะปลายทางเท่านั้นที่ยืนยันรับได้' }, { status: 403 })
      }
      if (transfer.status !== 'IN_TRANSIT' && transfer.status !== 'DISPUTED') {
        return Response.json({ error: 'สถานะปัจจุบันไม่สามารถยืนยันรับได้' }, { status: 422 })
      }

      try {
        await prisma.$transaction(async (tx) => {
          await tx.stockTransfer.update({
            where: { id: params.id },
            data: { status: 'DELIVERED', receivedAt: new Date() },
          })

          for (const item of transfer.items) {
            const current = await tx.stockItem.findUnique({ where: { id: item.stockItemId } })
            if (!current || current.quantity < item.quantity || current.reserved < item.quantity) {
              throw Object.assign(new Error('จำนวนในคลังไม่เพียงพอสำหรับการยืนยันรับของ'), { status: 422 })
            }
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
              const newItem = await tx.stockItem.create({
                data: {
                  shopId: transfer.toShopId,
                  name: item.stockItem.name,
                  category: item.stockItem.category,
                  unit: item.stockItem.unit,
                  quantity: item.quantity,
                  costPrice: item.stockItem.costPrice,
                },
              })
              await tx.stockAdjustLog.create({
                data: {
                  stockItemId: newItem.id,
                  delta: item.quantity,
                  reason: `transfer:${params.id}`,
                  userId,
                },
              })
            }
          }
        })
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string }
        if (e.status === 422) return Response.json({ error: e.message }, { status: 422 })
        throw err
      }

      return Response.json({ ok: true })
    }

    // ── CANCELLED ─────────────────────────────────────────────────────────────
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
        // Only release reserved if stock was already reserved (IN_TRANSIT or DISPUTED)
        if (transfer.status === 'IN_TRANSIT' || transfer.status === 'DISPUTED') {
          for (const item of transfer.items) {
            await tx.stockItem.update({
              where: { id: item.stockItemId },
              data: { reserved: { decrement: item.quantity } },
            })
          }
        }
      })

      return Response.json({ ok: true })
    }

    return Response.json({ error: 'status ที่รองรับ: IN_TRANSIT (approve), REJECTED, DELIVERED, CANCELLED' }, { status: 422 })
  } catch (err) {
    console.error('[PATCH /api/stock/transfers/[id]]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/tae/Desktop/playground/ddcar && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stock/transfers/
git commit -m "feat: transfers API support PARTNER_SALE (PENDING, approve, reject, cancel fix)"
```

---

## Task 5: Update Transfers UI — Tabs + PARTNER_SALE Features

**Files:**
- Modify: `src/app/stock/transfers/page.tsx`
- Modify: `src/app/stock/transfers/TransfersTable.tsx`
- Modify: `src/app/stock/transfers/new/page.tsx`

- [ ] **Step 1: Update `src/app/stock/transfers/page.tsx`**

แทนที่ทั้งไฟล์:

```typescript
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import TransfersTable from './TransfersTable'

export default async function TransfersPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, shopId } = session.user
  if (role === 'TECH') redirect('/')

  const [branchTransfers, partnerTransfers] = await Promise.all([
    prisma.stockTransfer.findMany({
      where: { OR: [{ fromShopId: shopId }, { toShopId: shopId }], type: 'BRANCH' },
      include: {
        fromShop: { select: { name: true } },
        toShop:   { select: { name: true } },
        items:    { include: { stockItem: { select: { name: true, unit: true } } } },
        disputes: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stockTransfer.findMany({
      where: { OR: [{ fromShopId: shopId }, { toShopId: shopId }], type: 'PARTNER_SALE' },
      include: {
        fromShop: { select: { name: true } },
        toShop:   { select: { name: true } },
        items:    { include: { stockItem: { select: { name: true, unit: true } } } },
        disputes: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <TransfersTable
        branchTransfers={branchTransfers}
        partnerTransfers={partnerTransfers}
        currentShopId={shopId}
        canManage={true}
      />
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/app/stock/transfers/TransfersTable.tsx`**

แทนที่ทั้งไฟล์:

```typescript
'use client'

import { useState } from 'react'
import { Table, Tag, Button, Modal, Input, Space, message, Tabs, Typography } from 'antd'
import dayjs from 'dayjs'

const { Title } = Typography

const STATUS_COLORS: Record<string, string> = {
  PENDING:    'gold',
  IN_TRANSIT: 'blue',
  DELIVERED:  'green',
  DISPUTED:   'orange',
  REJECTED:   'red',
  CANCELLED:  'default',
}
const STATUS_LABELS: Record<string, string> = {
  PENDING:    'รออนุมัติ',
  IN_TRANSIT: 'กำลังส่ง',
  DELIVERED:  'ส่งแล้ว',
  DISPUTED:   'ร้องขอ',
  REJECTED:   'ปฏิเสธ',
  CANCELLED:  'ยกเลิก',
}

interface TransferItem {
  id: string
  quantity: number
  stockItem: { name: string; unit: string }
}

interface Transfer {
  id: string
  type: string
  fromShopId: string
  toShopId: string
  fromShop: { name: string }
  toShop: { name: string }
  status: string
  deliveryDate: string | Date
  unitPrice: number | null
  items: TransferItem[]
  disputes: { message: string }[]
}

interface Props {
  branchTransfers: Transfer[]
  partnerTransfers: Transfer[]
  currentShopId: string
  canManage: boolean
}

export default function TransfersTable({ branchTransfers, partnerTransfers, currentShopId, canManage }: Props) {
  const [disputeId, setDisputeId] = useState<string | null>(null)
  const [disputeMsg, setDisputeMsg] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  async function patchTransfer(id: string, status: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/stock/transfers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) { const d = await res.json(); message.error(d.error); return }
      const labels: Record<string, string> = {
        DELIVERED: 'ยืนยันรับของสำเร็จ',
        IN_TRANSIT: 'อนุมัติสำเร็จ',
        REJECTED: 'ปฏิเสธสำเร็จ',
      }
      message.success(labels[status] ?? 'สำเร็จ')
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

  function branchColumns() {
    return [
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
        render: (d: string | Date) => dayjs(d).format('DD/MM/YYYY'),
      },
      {
        title: 'รายการของ',
        dataIndex: 'items',
        key: 'items',
        render: (items: TransferItem[]) =>
          items.map(i => `${i.stockItem.name} ×${i.quantity} ${i.stockItem.unit}`).join(', '),
      },
      ...(canManage ? [{
        title: '',
        key: 'actions',
        render: (_: unknown, r: Transfer) => {
          if (r.status !== 'IN_TRANSIT' && r.status !== 'DISPUTED') return null
          return (
            <Space size="small">
              <Button size="small" type="primary" loading={actionLoading}
                onClick={() => patchTransfer(r.id, 'DELIVERED')}>
                ยืนยันรับ
              </Button>
              {r.status === 'IN_TRANSIT' && (
                <Button size="small" danger onClick={() => setDisputeId(r.id)}>ร้องขอ</Button>
              )}
            </Space>
          )
        },
      }] : []),
    ]
  }

  function partnerColumns() {
    return [
      {
        title: 'ผู้ขาย → ผู้ซื้อ',
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
        title: 'ราคา/หน่วย (฿)',
        dataIndex: 'unitPrice',
        key: 'unitPrice',
        align: 'right' as const,
        render: (v: number | null) => v != null ? v.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-',
      },
      {
        title: 'วันส่งถึง',
        dataIndex: 'deliveryDate',
        key: 'deliveryDate',
        render: (d: string | Date) => dayjs(d).format('DD/MM/YYYY'),
      },
      {
        title: 'รายการของ',
        dataIndex: 'items',
        key: 'items',
        render: (items: TransferItem[]) =>
          items.map(i => `${i.stockItem.name} ×${i.quantity} ${i.stockItem.unit}`).join(', '),
      },
      ...(canManage ? [{
        title: '',
        key: 'actions',
        render: (_: unknown, r: Transfer) => {
          const isDestination = r.toShopId === currentShopId
          const isSource = r.fromShopId === currentShopId
          return (
            <Space size="small">
              {r.status === 'PENDING' && isDestination && (
                <>
                  <Button size="small" type="primary" loading={actionLoading}
                    onClick={() => patchTransfer(r.id, 'IN_TRANSIT')}>
                    อนุมัติ
                  </Button>
                  <Button size="small" danger loading={actionLoading}
                    onClick={() => patchTransfer(r.id, 'REJECTED')}>
                    ปฏิเสธ
                  </Button>
                </>
              )}
              {(r.status === 'IN_TRANSIT' || r.status === 'DISPUTED') && isDestination && (
                <Button size="small" type="primary" loading={actionLoading}
                  onClick={() => patchTransfer(r.id, 'DELIVERED')}>
                  ยืนยันรับ
                </Button>
              )}
              {r.status === 'PENDING' && isSource && (
                <Button size="small" loading={actionLoading}
                  onClick={() => patchTransfer(r.id, 'CANCELLED')}>
                  ยกเลิก
                </Button>
              )}
            </Space>
          )
        },
      }] : []),
    ]
  }

  return (
    <>
      <Title level={4} style={{ marginBottom: 16 }}>ประวัติการโอนอะไหล่</Title>
      <Tabs
        items={[
          {
            key: 'branch',
            label: `โอนภายในสาขา (${branchTransfers.length})`,
            children: (
              <Table
                dataSource={branchTransfers}
                columns={branchColumns()}
                rowKey="id"
                pagination={{ pageSize: 20 }}
                size="small"
              />
            ),
          },
          {
            key: 'partner',
            label: `ขายพันธมิตร (${partnerTransfers.length})`,
            children: (
              <Table
                dataSource={partnerTransfers}
                columns={partnerColumns()}
                rowKey="id"
                pagination={{ pageSize: 20 }}
                size="small"
              />
            ),
          },
        ]}
      />
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

- [ ] **Step 3: Replace `src/app/stock/transfers/new/page.tsx`**

แทนที่ทั้งไฟล์:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Form, Select, Button, Card, Typography, Alert, DatePicker,
  InputNumber, Space, Divider, Radio,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'

const { Title } = Typography

interface Shop { id: string; name: string }
interface PartnerRecord { id: string; partner: { id: string; name: string } }
interface StockItem { id: string; name: string; unit: string; availableQty: number }
interface PartRow { stockItemId: string; quantity: number }

export default function NewTransferPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transferType, setTransferType] = useState<'BRANCH' | 'PARTNER_SALE'>('BRANCH')
  const [branches, setBranches] = useState<Shop[]>([])
  const [partners, setPartners] = useState<Shop[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [parts, setParts] = useState<PartRow[]>([{ stockItemId: '', quantity: 1 }])

  useEffect(() => {
    fetch('/api/admin/shops').then(r => r.json()).then((shops: Shop[]) => setBranches(shops))
    fetch('/api/admin/partners').then(r => r.json()).then((records: PartnerRecord[]) => {
      setPartners(records.map(r => r.partner))
    })
    fetch('/api/stock').then(r => r.json()).then(setStockItems)
  }, [])

  function updatePart(index: number, field: keyof PartRow, value: string | number) {
    setParts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  function removePart(index: number) {
    setParts(prev => prev.filter((_, i) => i !== index))
  }

  async function onFinish(values: {
    toShopId: string
    deliveryDate: import('dayjs').Dayjs
    unitPrice?: number
  }) {
    const validParts = parts.filter(p => p.stockItemId && p.quantity > 0)
    if (validParts.length === 0) {
      setError('กรุณาเลือกอะไหล่อย่างน้อย 1 รายการ')
      return
    }
    if (transferType === 'PARTNER_SALE' && !values.unitPrice) {
      setError('กรุณาระบุราคาต่อหน่วยสำหรับการขายพันธมิตร')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stock/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: transferType,
          toShopId: values.toShopId,
          deliveryDate: values.deliveryDate.toISOString(),
          unitPrice: transferType === 'PARTNER_SALE' ? values.unitPrice : undefined,
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

  const destinationShops = transferType === 'BRANCH' ? branches : partners

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 640 }}>
      <Title level={4}>สร้างคำสั่งโอนอะไหล่</Title>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>

          <Form.Item label="ประเภทการโอน">
            <Radio.Group
              value={transferType}
              onChange={e => {
                setTransferType(e.target.value)
                form.setFieldValue('toShopId', undefined)
              }}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="BRANCH">โอนภายในสาขา</Radio.Button>
              <Radio.Button value="PARTNER_SALE">ขายพันธมิตร</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            label={transferType === 'BRANCH' ? 'สาขาปลายทาง' : 'ร้านพันธมิตร (ผู้ซื้อ)'}
            name="toShopId"
            rules={[{ required: true, message: 'กรุณาเลือกปลายทาง' }]}
          >
            <Select
              placeholder="เลือกร้าน"
              options={destinationShops.map(s => ({ label: s.name, value: s.id }))}
            />
          </Form.Item>

          {transferType === 'PARTNER_SALE' && (
            <Form.Item
              label="ราคาต่อหน่วย (฿)"
              name="unitPrice"
              rules={[{ required: true, message: 'กรุณาระบุราคาต่อหน่วย' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0.01} precision={2} placeholder="0.00" />
            </Form.Item>
          )}

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
            <Button type="primary" htmlType="submit" loading={loading}>
              {transferType === 'BRANCH' ? 'สร้างคำสั่งโอน' : 'ส่งคำขอขาย'}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/tae/Desktop/playground/ddcar && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/stock/transfers/
git commit -m "feat: update transfers UI with tabs (BRANCH/PARTNER_SALE), approve/reject, unitPrice"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| ShopPartner model (many-to-many) | Task 1 |
| Partner management API (list, add, remove) | Task 2 |
| Partner admin page + nav | Task 3 |
| PARTNER_SALE: starts PENDING, unitPrice required | Task 4 POST |
| PARTNER_SALE: validate partner relationship | Task 4 POST |
| PARTNER_SALE: destination approves → IN_TRANSIT + reserve | Task 4 PATCH |
| PARTNER_SALE: destination rejects → REJECTED | Task 4 PATCH |
| PARTNER_SALE: CANCELLED from PENDING (no stock release) | Task 4 PATCH |
| CANCELLED fix: only release reserved if was IN_TRANSIT/DISPUTED | Task 4 PATCH |
| Transfers page: tabs BRANCH / PARTNER_SALE | Task 5 |
| Transfers table: approve/reject buttons (destination only) | Task 5 |
| Transfers table: unitPrice column for PARTNER_SALE | Task 5 |
| New transfer form: type selector | Task 5 |
| New transfer form: partner shop list from /api/admin/partners | Task 5 |
| New transfer form: unitPrice field for PARTNER_SALE | Task 5 |

**Placeholder scan:** None found — all steps have complete code.

**Type consistency:**
- `Transfer.unitPrice: number | null` — consistent across page.tsx, TransfersTable.tsx, API
- `ShopPartner.shopId_partnerId` compound unique — used in `findUnique` correctly in Task 4
- `transferType: 'BRANCH' | 'PARTNER_SALE'` — consistent across new/page.tsx and API

**Known limitation:** `GET /api/admin/partners` for SHOP_ADMIN returns partner records with `partner` shape `{ id, name }`. In `new/page.tsx`, the response is mapped as `PartnerRecord[]` → `partner.id/name`. When SUPER_ADMIN uses this endpoint, the shape is `{ id, shop: { id, name }, partner: { id, name } }` (different from SHOP_ADMIN shape). The `new/page.tsx` uses `r.partner` which works for SHOP_ADMIN but may fail for SUPER_ADMIN. **Fix:** SUPER_ADMIN should use the SHOP_ADMIN-compatible shape. Since SUPER_ADMIN also has `shopId` in session, consider adding a `?shopId=` param filter OR always return from the SHOP_ADMIN perspective (query `WHERE shopId = session.shopId`). The GET handler already handles this correctly — SUPER_ADMIN sees all pairs in dedup form, SHOP_ADMIN sees their own. The `new/page.tsx` should work correctly since every user has a `shopId` and the GET will be called as SHOP_ADMIN-style (their own shopId). However, a SUPER_ADMIN creating a transfer from their shop works fine since the response for them is the dedup pairs format `{ shop, partner }` not `{ partner }`. **Action:** Update the GET handler to always return in a consistent `{ id, shop: {...}, partner: {...} }` format for all roles, and update `new/page.tsx` to extract `r.partner` accordingly.

**Fix for type consistency in GET /api/admin/partners:** Change the SHOP_ADMIN response to also include `shop` field:

In Task 2 Step 1, the SHOP_ADMIN GET should use:
```typescript
const records = await prisma.shopPartner.findMany({
  where: { shopId },
  include: {
    shop:    { select: { id: true, name: true } },  // add this
    partner: { select: { id: true, name: true } },
  },
  orderBy: { createdAt: 'asc' },
})
```

This makes both SUPER_ADMIN and SHOP_ADMIN return `{ id, shop, partner }` consistently. The `new/page.tsx` `PartnerRecord` interface and `r.partner` access is then correct for all roles.

> **Note to implementer:** Apply this fix when implementing Task 2 — the SHOP_ADMIN branch of the GET handler should include `shop: { select: { id: true, name: true } }` in the Prisma query.
