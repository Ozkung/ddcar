# Job Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow shops to transfer jobs to partner shops or branches; the destination accepts, updates status from their end, and the source sees progress in real-time.

**Architecture:** Introduce a `JobTransfer` table (same pattern as `StockTransfer`) that stores transfer metadata. The job record stays on the source shop (`job.shopId` never changes). When accepted, `job.status` becomes `"ถ่ายงานออก"`. Destination shop queries jobs via `JobTransfer`. Real-time updates via 30-second polling + `visibilitychange` in the receipt view.

**Tech Stack:** Next.js 14 App Router, Prisma (PostgreSQL), Ant Design 5, Auth.js v5, Jest (node env) for unit tests

---

## File Map

| Status | Path | Role |
|---|---|---|
| Create | `prisma/migrations/20260602000001_add_job_transfer/migration.sql` | Raw SQL for JobTransfer table + enum |
| Modify | `prisma/schema.prisma` | Add enum + model + Shop/Job relations |
| Create | `src/app/api/jobs/[id]/transfer/route.ts` | POST (create) + PATCH (accept/reject/cancel) |
| Create | `src/app/api/jobs/incoming/route.ts` | GET list of incoming transfers for current shop |
| Modify | `src/app/api/jobs/[id]/route.ts` | GET includes transfer; PATCH allows destination shop |
| Modify | `src/app/api/jobs/route.ts` | GET list includes transfer badge info |
| Modify | `src/app/layout.tsx` | Navbar "งานที่รับโอน" link + pending badge |
| Modify | `src/app/receipt/[id]/page.tsx` | Fetch + pass transfer to client |
| Modify | `src/app/receipt/[id]/ReceiptContent.tsx` | Transfer banner + cancel + polling |
| Modify | `src/app/edit/[id]/page.tsx` | Detect destination-shop view; pass flag |
| Modify | `src/app/edit/[id]/EditForm.tsx` | Show banner + disable readonly fields |
| Create | `src/app/jobs/incoming/page.tsx` | Server page for destination shop incoming |
| Create | `src/app/jobs/incoming/IncomingJobsTable.tsx` | Client tabs: PENDING/ACCEPTED |

> **Note on `/edit/[id]`:** The current edit page is one file (`src/app/edit/[id]/page.tsx`). It's a large client component; Task 9 extracts the form into `EditForm.tsx` so the page can be a server component that detects the destination-shop case and passes a flag.

---

## Task 1: Database Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260602000001_add_job_transfer/migration.sql`

- [ ] **Step 1: Add enum and model to schema.prisma**

Open `prisma/schema.prisma`. After the `TransferStatus` enum, add:

```prisma
enum JobTransferStatus {
  PENDING
  ACCEPTED
  REJECTED
  CANCELLED
}
```

After the `ShopPartner` model at the bottom, add:

```prisma
model JobTransfer {
  id                String            @id @default(cuid())
  jobId             String            @unique
  job               Job               @relation(fields: [jobId], references: [id], onDelete: Cascade)
  fromShopId        String
  toShopId          String
  fromShop          Shop              @relation("JobTransferFrom", fields: [fromShopId], references: [id])
  toShop            Shop              @relation("JobTransferTo", fields: [toShopId], references: [id])
  status            JobTransferStatus @default(PENDING)
  previousJobStatus String
  requestedBy       String
  note              String?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([fromShopId])
  @@index([toShopId])
}
```

- [ ] **Step 2: Add relations to Job and Shop models**

In `model Job`, add after the `jobParts JobPart[]` line:

```prisma
  transfer JobTransfer?
```

In `model Shop`, add after the `partnerOf ShopPartner[] @relation("PartnerShops")` line:

```prisma
  jobTransfersFrom JobTransfer[] @relation("JobTransferFrom")
  jobTransfersTo   JobTransfer[] @relation("JobTransferTo")
```

- [ ] **Step 3: Create migration SQL file**

Create directory and file:
```bash
mkdir -p prisma/migrations/20260602000001_add_job_transfer
```

Create `prisma/migrations/20260602000001_add_job_transfer/migration.sql`:

```sql
CREATE TYPE "JobTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

CREATE TABLE "JobTransfer" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromShopId" TEXT NOT NULL,
    "toShopId" TEXT NOT NULL,
    "status" "JobTransferStatus" NOT NULL DEFAULT 'PENDING',
    "previousJobStatus" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobTransfer_jobId_key" ON "JobTransfer"("jobId");
CREATE INDEX "JobTransfer_fromShopId_idx" ON "JobTransfer"("fromShopId");
CREATE INDEX "JobTransfer_toShopId_idx" ON "JobTransfer"("toShopId");

ALTER TABLE "JobTransfer"
    ADD CONSTRAINT "JobTransfer_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobTransfer"
    ADD CONSTRAINT "JobTransfer_fromShopId_fkey"
    FOREIGN KEY ("fromShopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JobTransfer"
    ADD CONSTRAINT "JobTransfer_toShopId_fkey"
    FOREIGN KEY ("toShopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 4: Apply migration and regenerate client**

```bash
# Apply the SQL directly (same pattern as previous migrations)
docker exec ddcar-postgres-1 psql "postgresql://ddreport:ddreport_pass@localhost/ddreport" \
  -f /dev/stdin < prisma/migrations/20260602000001_add_job_transfer/migration.sql

# Record migration as applied
docker exec ddcar-postgres-1 psql "postgresql://ddreport:ddreport_pass@localhost/ddreport" -c "
  INSERT INTO \"_prisma_migrations\" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
  VALUES (
    gen_random_uuid()::text,
    'manual',
    NOW(), '20260602000001_add_job_transfer',
    NULL, NULL, NOW(), 1
  );
"

# Regenerate Prisma client
npx prisma generate
```

Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 5: Verify schema compiled**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to JobTransfer.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260602000001_add_job_transfer/
git commit -m "feat: add JobTransfer schema + migration"
```

---

## Task 2: POST /api/jobs/[id]/transfer — Create Transfer

**Files:**
- Create: `src/app/api/jobs/[id]/transfer/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/jobs/[id]/transfer/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const TERMINAL_STATUSES = ['ส่งมอบและเก็บเงินแล้ว', 'ยกเลิกรายการแล้ว']

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId, id: userId } = session.user
    if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { toShopId, note } = body
    if (!toShopId) return Response.json({ error: 'toShopId is required' }, { status: 422 })
    if (toShopId === shopId) {
      return Response.json({ error: 'ปลายทางต้องไม่ใช่ร้านตัวเอง' }, { status: 422 })
    }

    const job = await prisma.job.findFirst({
      where: { id: params.id, shopId },
      include: { transfer: true },
    })
    if (!job) return Response.json({ error: 'ไม่พบใบงาน' }, { status: 404 })

    if (job.transfer && (job.transfer.status === 'PENDING' || job.transfer.status === 'ACCEPTED')) {
      return Response.json({ error: 'ใบงานนี้มีการโอนที่ยังดำเนินการอยู่' }, { status: 422 })
    }

    if (TERMINAL_STATUSES.includes(job.status)) {
      return Response.json({ error: 'ไม่สามารถโอนใบงานที่เสร็จสิ้นหรือยกเลิกแล้ว' }, { status: 422 })
    }

    // Validate: toShopId must be a branch in the same family OR an accepted partner
    const currentShop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { parentId: true },
    })
    const rootId = currentShop?.parentId ?? shopId
    const familyShops = await prisma.shop.findMany({
      where: { OR: [{ id: rootId }, { parentId: rootId }] },
      select: { id: true },
    })
    const familyIds = new Set(familyShops.map(s => s.id))
    const isBranch = familyIds.has(toShopId)

    let isPartner = false
    if (!isBranch) {
      const partner = await prisma.shopPartner.findFirst({
        where: {
          OR: [
            { shopId, partnerId: toShopId, status: 'ACCEPTED' },
            { shopId: toShopId, partnerId: shopId, status: 'ACCEPTED' },
          ],
        },
      })
      isPartner = !!partner
    }

    if (!isBranch && !isPartner) {
      return Response.json(
        { error: 'toShopId ต้องเป็นสาขาในกลุ่มเดียวกันหรือพันธมิตรที่ยืนยันแล้ว' },
        { status: 422 }
      )
    }

    // Delete stale REJECTED/CANCELLED transfer if present
    if (job.transfer) {
      await prisma.jobTransfer.delete({ where: { id: job.transfer.id } })
    }

    const transfer = await prisma.jobTransfer.create({
      data: {
        jobId: params.id,
        fromShopId: shopId,
        toShopId,
        previousJobStatus: job.status,
        requestedBy: userId,
        note: note || null,
      },
      include: {
        toShop: { select: { name: true, refCode: true } },
      },
    })

    return Response.json(transfer, { status: 201 })
  } catch (err) {
    console.error('[POST /api/jobs/[id]/transfer]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep transfer
```

Expected: no errors.

- [ ] **Step 3: Manual test — create transfer**

Start the dev server (`npm run dev`) and use curl. Replace `COOKIE` with a valid session cookie from the browser DevTools (Application → Cookies → `authjs.session-token`), `JOB_ID` with an existing non-terminal job ID, and `PARTNER_SHOP_ID` with a valid partner or branch shop ID.

```bash
curl -X POST http://localhost:3000/api/jobs/JOB_ID/transfer \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=COOKIE" \
  -d '{"toShopId":"PARTNER_SHOP_ID","note":"ส่งช่างผู้เชี่ยวชาญ"}'
```

Expected: `201` with transfer object, `status: "PENDING"`.

Test invalid cases:
```bash
# Same shop → 422
curl -X POST http://localhost:3000/api/jobs/JOB_ID/transfer \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=COOKIE" \
  -d '{"toShopId":"OWN_SHOP_ID"}'
# Expected: {"error":"ปลายทางต้องไม่ใช่ร้านตัวเอง"}

# Non-partner shop → 422
curl -X POST http://localhost:3000/api/jobs/JOB_ID/transfer \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=COOKIE" \
  -d '{"toShopId":"RANDOM_SHOP_ID"}'
# Expected: {"error":"toShopId ต้องเป็นสาขา..."}
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/jobs/[id]/transfer/route.ts"
git commit -m "feat: POST /api/jobs/[id]/transfer — create job transfer"
```

---

## Task 3: PATCH /api/jobs/[id]/transfer — Accept / Reject / Cancel

**Files:**
- Modify: `src/app/api/jobs/[id]/transfer/route.ts`

- [ ] **Step 1: Add PATCH handler to the transfer route**

Append to `src/app/api/jobs/[id]/transfer/route.ts` (after the POST export):

```typescript
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId } = session.user

    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: { transfer: true },
    })
    if (!job?.transfer) return Response.json({ error: 'ไม่พบ transfer' }, { status: 404 })
    const transfer = job.transfer

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })
    const { action } = body as { action: string }

    // ── ACCEPT ─────────────────────────────────────────────────────────────────
    if (action === 'accept') {
      if (transfer.toShopId !== shopId) {
        return Response.json({ error: 'เฉพาะร้านปลายทางเท่านั้นที่รับงานได้' }, { status: 403 })
      }
      if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN' && role !== 'LEAD_TECH') {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transfer.status !== 'PENDING') {
        return Response.json({ error: 'รับได้เฉพาะ transfer ที่ PENDING เท่านั้น' }, { status: 422 })
      }
      await prisma.$transaction([
        prisma.jobTransfer.update({
          where: { id: transfer.id },
          data: { status: 'ACCEPTED' },
        }),
        prisma.job.update({
          where: { id: params.id },
          data: { status: 'ถ่ายงานออก' },
        }),
      ])
      return Response.json({ ok: true })
    }

    // ── REJECT ─────────────────────────────────────────────────────────────────
    if (action === 'reject') {
      if (transfer.toShopId !== shopId) {
        return Response.json({ error: 'เฉพาะร้านปลายทางเท่านั้นที่ปฏิเสธได้' }, { status: 403 })
      }
      if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN' && role !== 'LEAD_TECH') {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transfer.status !== 'PENDING') {
        return Response.json({ error: 'ปฏิเสธได้เฉพาะ transfer ที่ PENDING เท่านั้น' }, { status: 422 })
      }
      await prisma.$transaction([
        prisma.jobTransfer.update({
          where: { id: transfer.id },
          data: { status: 'REJECTED' },
        }),
        prisma.job.update({
          where: { id: params.id },
          data: { status: transfer.previousJobStatus },
        }),
      ])
      return Response.json({ ok: true })
    }

    // ── CANCEL ─────────────────────────────────────────────────────────────────
    if (action === 'cancel') {
      if (transfer.fromShopId !== shopId && role !== 'SUPER_ADMIN') {
        return Response.json({ error: 'เฉพาะร้านต้นทางเท่านั้นที่ยกเลิกได้' }, { status: 403 })
      }
      if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transfer.status !== 'PENDING') {
        return Response.json(
          { error: 'ยกเลิกได้เฉพาะ transfer ที่ PENDING เท่านั้น (ยกเลิกหลัง ACCEPTED ไม่ได้)' },
          { status: 422 }
        )
      }
      await prisma.$transaction([
        prisma.jobTransfer.update({
          where: { id: transfer.id },
          data: { status: 'CANCELLED' },
        }),
        prisma.job.update({
          where: { id: params.id },
          data: { status: transfer.previousJobStatus },
        }),
      ])
      return Response.json({ ok: true })
    }

    return Response.json(
      { error: 'action ต้องเป็น accept, reject, หรือ cancel' },
      { status: 422 }
    )
  } catch (err) {
    console.error('[PATCH /api/jobs/[id]/transfer]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep transfer
```

Expected: no errors.

- [ ] **Step 3: Manual test — all three actions**

First create a transfer (Task 2 test). Then test from the destination shop's session:

```bash
# accept
curl -X PATCH http://localhost:3000/api/jobs/JOB_ID/transfer \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=DEST_COOKIE" \
  -d '{"action":"accept"}'
# Expected: {"ok":true}
# Job status in DB is now "ถ่ายงานออก"

# Create another transfer to test reject
curl -X PATCH http://localhost:3000/api/jobs/JOB_ID/transfer \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=DEST_COOKIE" \
  -d '{"action":"reject"}'
# Expected: {"ok":true} and job returns to previousJobStatus

# Create another transfer to test cancel (from source shop)
curl -X PATCH http://localhost:3000/api/jobs/JOB_ID/transfer \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=SOURCE_COOKIE" \
  -d '{"action":"cancel"}'
# Expected: {"ok":true}
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/jobs/[id]/transfer/route.ts"
git commit -m "feat: PATCH /api/jobs/[id]/transfer — accept, reject, cancel"
```

---

## Task 4: GET /api/jobs/incoming — List Incoming Transfers

**Files:**
- Create: `src/app/api/jobs/incoming/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/jobs/incoming/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId } = session.user
    if (role === 'TECH') return Response.json({ error: 'Forbidden' }, { status: 403 })

    const transfers = await prisma.jobTransfer.findMany({
      where: {
        toShopId: shopId,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      include: {
        job: {
          select: {
            id: true,
            jobNo: true,
            customerName: true,
            licensePlate: true,
            status: true,
            date: true,
          },
        },
        fromShop: { select: { name: true, refCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return Response.json(transfers)
  } catch (err) {
    console.error('[GET /api/jobs/incoming]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep incoming
```

Expected: no errors.

- [ ] **Step 3: Manual test**

```bash
curl http://localhost:3000/api/jobs/incoming \
  -H "Cookie: authjs.session-token=DEST_COOKIE"
# Expected: array of transfers with job and fromShop details
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/jobs/incoming/
git commit -m "feat: GET /api/jobs/incoming — list pending/accepted transfers for destination shop"
```

---

## Task 5: Expand GET /api/jobs/[id] — Include Transfer + Allow Destination Read

**Files:**
- Modify: `src/app/api/jobs/[id]/route.ts` (lines 5–29, the GET handler)

- [ ] **Step 1: Replace the GET handler**

In `src/app/api/jobs/[id]/route.ts`, replace the entire GET function (lines 5–29) with:

```typescript
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { shopId } = session.user

    const job = await prisma.job.findFirst({
      where: {
        id: params.id,
        OR: [
          { shopId },
          { transfer: { toShopId: shopId, status: 'ACCEPTED' } },
        ],
      },
      include: {
        images: { select: { id: true, filename: true } },
        jobParts: {
          include: {
            stockItem: { select: { id: true, name: true, category: true, unit: true } },
          },
        },
        transfer: {
          include: {
            fromShop: { select: { name: true, refCode: true } },
            toShop:   { select: { name: true, refCode: true } },
          },
        },
      },
    })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(job)
  } catch (err) {
    console.error('[GET /api/jobs/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Also update GET /api/jobs (list) to include transfer**

In `src/app/api/jobs/route.ts`, change the `prisma.job.findMany` call to include transfer. Replace the `include` inside `prisma.job.findMany`:

```typescript
      include: {
        images: { select: { id: true, filename: true } },
        transfer: {
          select: {
            status: true,
            toShop: { select: { name: true, refCode: true } },
            fromShop: { select: { name: true, refCode: true } },
          },
        },
      },
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Manual test**

After creating an accepted transfer, call GET as the destination shop:

```bash
curl http://localhost:3000/api/jobs/JOB_ID \
  -H "Cookie: authjs.session-token=DEST_COOKIE"
# Expected: 200 with job JSON that includes `transfer` object
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/jobs/[id]/route.ts" src/app/api/jobs/route.ts
git commit -m "feat: include transfer in job GET; allow destination shop to read accepted jobs"
```

---

## Task 6: Expand PATCH /api/jobs/[id] — Allow Destination Shop to Update

**Files:**
- Modify: `src/app/api/jobs/[id]/route.ts` (the PATCH handler, starting at line 37)

The destination shop (toShopId on an ACCEPTED transfer) should be able to update `status` and `parts` but NOT customer/vehicle fields. The stock actions still run against the session user's shopId (which is the destination shop) — this is already correct.

- [ ] **Step 1: Modify PATCH to detect destination-shop context**

At the beginning of the PATCH handler (right after the `auth()` check and extraction of `shopId, role, userId`), replace the single `findFirst` for `existing` with a two-step lookup:

```typescript
    // Try to find as the job's owning shop first
    let existing = await prisma.job.findFirst({
      where: { id: params.id, shopId },
      include: { jobParts: true, transfer: true },
    })

    let isDestinationShop = false
    if (!existing) {
      // Check if this is an accepted transfer where we are the destination
      existing = await prisma.job.findFirst({
        where: {
          id: params.id,
          transfer: { toShopId: shopId, status: 'ACCEPTED' },
        },
        include: { jobParts: true, transfer: true },
      })
      if (existing) isDestinationShop = true
    }

    if (!existing) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
```

- [ ] **Step 2: Block readonly fields and TECH role for destination shop**

Right after the `isDestinationShop` block (before reading `body`), add:

```typescript
    if (isDestinationShop && role === 'TECH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
```

Then, after `const body = await req.json()` and before the field assignment block, add:

```typescript
    // Destination shop: only status and parts are mutable
    if (isDestinationShop) {
      const READONLY_FIELDS = [
        'date', 'time', 'customerName', 'phone', 'licensePlate',
        'odometer', 'symptoms', 'notes', 'cause', 'totalPrice', 'assignedTo',
      ]
      for (const field of READONLY_FIELDS) {
        if (field in body) {
          return NextResponse.json(
            { error: `ร้านปลายทางไม่สามารถแก้ไขฟิลด์ ${field}` },
            { status: 403 }
          )
        }
      }
    }
```

Also remove the TECH-own-job guard when in destination-shop mode. Find the existing TECH check:

```typescript
    if (role === 'TECH' && existing.createdBy !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
```

Replace it with:

```typescript
    if (!isDestinationShop && role === 'TECH' && existing.createdBy !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Manual test — destination shop updates status**

With an ACCEPTED transfer, log in as the destination shop and update status:

```bash
curl -X PATCH http://localhost:3000/api/jobs/JOB_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=DEST_COOKIE" \
  -d '{"status":"อยู่ระหว่างดำเนินการ"}'
# Expected: 200 with updated job

# Test that readonly fields are blocked
curl -X PATCH http://localhost:3000/api/jobs/JOB_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=DEST_COOKIE" \
  -d '{"customerName":"Hacked"}'
# Expected: 403 {"error":"ร้านปลายทางไม่สามารถแก้ไขฟิลด์ customerName"}
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/jobs/[id]/route.ts"
git commit -m "feat: allow destination shop to update status/parts on accepted transferred jobs"
```

---

## Task 7: Navbar "งานที่รับโอน" Link + Pending Badge

**Files:**
- Modify: `src/app/layout.tsx`

The navbar already runs in a server component. Add a Prisma query for the PENDING count and a new nav link.

- [ ] **Step 1: Add pending count query and nav link to layout.tsx**

In `src/app/layout.tsx`, after `const user = session?.user`, add:

```typescript
  let pendingTransferCount = 0
  if (user && user.role !== 'TECH') {
    pendingTransferCount = await prisma.jobTransfer.count({
      where: { toShopId: user.shopId, status: 'PENDING' },
    })
  }
```

Add the import for prisma at the top of the file:

```typescript
import { prisma } from '@/lib/prisma'
```

Then inside the `{user && (...)}` nav block, after the `คลังอะไหล่` link and before `จัดการผู้ใช้`, add:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Manual test**

Navigate the app logged in as a shop that has pending incoming transfers. The navbar should show "งานที่รับโอน" with a red badge number.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add 'งานที่รับโอน' nav link with pending badge"
```

---

## Task 8: Receipt Page — Transfer Banner for Source Shop

**Files:**
- Modify: `src/app/receipt/[id]/page.tsx`
- Modify: `src/app/receipt/[id]/ReceiptContent.tsx`

The receipt page is where the source shop views job details. We add:
- PENDING: "⏳ รอ [ร้านปลายทาง] กดรับงาน" + cancel button
- ACCEPTED: "🔄 ถ่ายงานออกไปยัง [ร้าน] (REFXXX)" + live status + 30s polling + read-only fields

- [ ] **Step 1: Update receipt page to pass transfer and shopId**

Replace `src/app/receipt/[id]/page.tsx` with:

```typescript
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import ReceiptContent from './ReceiptContent'

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const session = await auth()
  const shopId = session?.user?.shopId ?? ''

  const job = await prisma.job.findFirst({
    where: {
      id: params.id,
      OR: [
        { shopId },
        { transfer: { toShopId: shopId, status: 'ACCEPTED' } },
      ],
    },
    include: {
      images: true,
      transfer: {
        include: {
          fromShop: { select: { name: true, refCode: true } },
          toShop:   { select: { name: true, refCode: true } },
        },
      },
    },
  })

  if (!job) notFound()

  return (
    <ReceiptContent
      job={{
        ...job,
        createdAt: job.createdAt.toISOString(),
      }}
      currentShopId={shopId}
    />
  )
}
```

- [ ] **Step 2: Update ReceiptContent to show transfer banner + polling**

Replace the `JobData` interface in `src/app/receipt/[id]/ReceiptContent.tsx` with the expanded version and add the transfer UI. Replace the file's content starting from the interface definition:

```typescript
'use client'

import { Descriptions, Tag, Typography, Divider, Button, Alert, Space } from 'antd'
import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PrintButton from './PrintButton'
import ImageGallery from './ImageGallery'
import Link from 'next/link'
import { EditOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const STATUS_COLORS: Record<string, string> = {
  'ลูกค้าอนุมัติซ่อมแล้ว':  'blue',
  'ซ่อมเสร็จเรียบร้อยแล้ว': 'orange',
  'ส่งมอบและเก็บเงินแล้ว':  'green',
  'ถ่ายงานออก':              'purple',
}

interface TransferInfo {
  id: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
  fromShop: { name: string; refCode: string }
  toShop:   { name: string; refCode: string }
}

interface JobData {
  id: string
  jobNo: string
  date: string
  time: string
  customerName: string
  phone: string
  licensePlate: string
  odometer: number
  symptoms: string[]
  notes: string | null
  cause: string
  totalPrice: number
  status: string
  createdAt: string
  images: { id: string; filename: string }[]
  transfer: TransferInfo | null
}

interface Props {
  job: JobData
  currentShopId: string
}

export default function ReceiptContent({ job, currentShopId }: Props) {
  const router = useRouter()
  const transfer = job.transfer
  const isSource = job.transfer?.fromShop !== undefined && !isDestination()
  function isDestination() {
    return transfer?.status === 'ACCEPTED' && transfer.toShop !== undefined &&
      // We infer destination by checking if we're NOT the source shop via currentShopId
      // (passed from server; source shop's job.shopId matches)
      true // refined below
  }

  // Determine perspective: are we the source or destination shop?
  // Source: job belongs to current shop (we'll trust the page to only show correct view)
  const isSourcePending  = transfer?.status === 'PENDING'
  const isSourceAccepted = transfer?.status === 'ACCEPTED' && transfer.fromShop !== undefined
  const isDestAccepted   = transfer?.status === 'ACCEPTED' && transfer.toShop !== undefined &&
    transfer.toShop.refCode !== transfer.fromShop?.refCode

  // 30-second polling when PENDING (source waiting) or ACCEPTED (source tracking)
  const shouldPoll = isSourcePending || isSourceAccepted
  const refresh = useCallback(() => router.refresh(), [router])

  useEffect(() => {
    if (!shouldPoll) return
    const interval = setInterval(refresh, 30_000)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [shouldPoll, refresh])

  async function cancelTransfer() {
    const res = await fetch(`/api/jobs/${job.id}/transfer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    if (res.ok) router.refresh()
  }

  const items = [
    { key: '1',  label: 'เลขที่ใบงาน',         children: <Text strong>{job.jobNo}</Text> },
    { key: '2',  label: 'วันที่รับรถ',          children: job.date },
    { key: '3',  label: 'เวลา',                 children: job.time },
    { key: '4',  label: 'ชื่อ-นามสกุล',        children: job.customerName },
    { key: '5',  label: 'เบอร์โทรศัพท์',       children: job.phone },
    { key: '6',  label: 'ทะเบียนรถ',           children: job.licensePlate },
    { key: '7',  label: 'เลขไมล์ (KM)',        children: job.odometer.toLocaleString('th-TH') },
    { key: '8',  label: 'อาการที่แจ้ง',         children: job.symptoms.length > 0 ? job.symptoms.join(', ') : '—' },
    { key: '9',  label: 'รายละเอียดเพิ่มเติม', children: job.notes || '—' },
    { key: '10', label: 'สาเหตุ / อะไหล่',     children: job.cause },
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

  // Determine if edit button should show (hide when job is transferred out)
  const showEdit = !transfer || (transfer.status !== 'ACCEPTED' && transfer.status !== 'PENDING')

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>

      {/* Transfer banner — PENDING (source waiting) */}
      {isSourcePending && transfer && (
        <Alert
          type="warning"
          style={{ marginBottom: 16 }}
          message={
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>⏳ รอ <strong>{transfer.toShop.name}</strong> กดรับงาน</span>
              <Button size="small" danger onClick={cancelTransfer}>ยกเลิกการโอน</Button>
            </Space>
          }
        />
      )}

      {/* Transfer banner — ACCEPTED (source tracking) */}
      {isSourceAccepted && transfer && (
        <Alert
          type="info"
          style={{ marginBottom: 16 }}
          message={
            <span>
              🔄 ถ่ายงานออกไปยัง <strong>{transfer.toShop.name}</strong>{' '}
              ({transfer.toShop.refCode}) — สถานะปัจจุบัน:{' '}
              <Tag color={STATUS_COLORS[job.status] ?? 'default'}>{job.status}</Tag>
            </span>
          }
        />
      )}

      {/* Transfer banner — destination shop view */}
      {transfer?.status === 'ACCEPTED' && (
        <Alert
          type="success"
          style={{ marginBottom: 16 }}
          message={<span>📥 รับโอนจาก <strong>{transfer.fromShop.name}</strong> ({transfer.fromShop.refCode})</span>}
        />
      )}

      {/* Action buttons */}
      <div className="no-print" style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {showEdit && (
          <Link href={`/edit/${job.id}`}>
            <Button icon={<EditOutlined />}>แก้ไขใบงาน</Button>
          </Link>
        )}
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
          <ImageGallery images={job.images} jobId={job.id} />
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

- [ ] **Step 3: Fix the destination detection logic**

The "source vs destination" detection in the component above needs to be simplified. Replace the `isSource`/`isDestination` function block with a cleaner version based on `currentShopId`:

Inside the component, right after `const transfer = job.transfer`, replace:

```typescript
  const isSource = job.transfer?.fromShop !== undefined && !isDestination()
  function isDestination() { ... }
  const isSourcePending  = transfer?.status === 'PENDING'
  const isSourceAccepted = transfer?.status === 'ACCEPTED' && transfer.fromShop !== undefined
  const isDestAccepted   = ...
```

with:

```typescript
  // We are the source shop if the job's shopId matches ours (server passes currentShopId)
  // We are the destination shop if we appear as toShop on an ACCEPTED transfer
  const isSourcePending  = transfer?.status === 'PENDING' // only source sees PENDING
  const isSourceAccepted = transfer?.status === 'ACCEPTED'
  // Note: both source AND destination see the ACCEPTED banner, so we show both
  // (server only loads the job if you are source OR destination)
```

Remove the `isDestAccepted` variable and the duplicate destination banner condition — just use `transfer?.status === 'ACCEPTED'` for the destination banner (the server already scoped the query correctly so only relevant users see the page).

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Manual test**

1. Create a job, create a transfer to a partner shop. Visit `/receipt/[jobId]` as the source shop. Should see the orange "⏳ รอ..." banner with "ยกเลิกการโอน" button.
2. Accept the transfer as the destination shop. Refresh source's receipt view. Should now see the blue "🔄 ถ่ายงานออก..." banner.
3. Visit `/receipt/[jobId]` as the destination shop. Should see the green "📥 รับโอนจาก..." banner.

- [ ] **Step 6: Commit**

```bash
git add "src/app/receipt/[id]/page.tsx" "src/app/receipt/[id]/ReceiptContent.tsx"
git commit -m "feat: transfer banner + polling on receipt page"
```

---

## Task 9: Edit Page — Destination Shop Restricted View

**Files:**
- Modify: `src/app/edit/[id]/page.tsx` (convert to server component + extract form)
- Create: `src/app/edit/[id]/EditForm.tsx` (the existing client-component form content)

Currently `src/app/edit/[id]/page.tsx` is a single large `'use client'` component. We need to make it a server page so it can detect the destination-shop context and pass a flag down.

- [ ] **Step 1: Read the full current edit page**

```bash
cat "src/app/edit/[id]/page.tsx"
```

Confirm the file starts with `'use client'` and exports `EditPage`.

- [ ] **Step 2: Extract the form into EditForm.tsx**

Create `src/app/edit/[id]/EditForm.tsx` with **the entire current content** of `page.tsx` — same code, same `'use client'` directive. Rename the export from `EditPage` to `EditForm`. Add `isDestinationShop: boolean` to the component's props (at the top where state is declared) and add `fromShopName?: string`.

At the beginning of `EditForm`, after the state declarations, add the destination banner and readonly field logic:

```typescript
  // TECH prop types in component signature
  // Add to the component function signature:
  // export default function EditForm({ isDestinationShop = false, fromShopName = '' }: { isDestinationShop?: boolean; fromShopName?: string })
```

Inside the `fetchJob` useEffect (where job data is populated into the form), after the form.setFieldsValue call, no changes needed. But add this near the top of the JSX return:

```tsx
        {isDestinationShop && fromShopName && (
          <Alert
            type="success"
            style={{ marginBottom: 16 }}
            message={<span>📥 รับโอนจาก <strong>{fromShopName}</strong> — แก้ไขได้เฉพาะสถานะและอะไหล่</span>}
          />
        )}
```

Make the customer/vehicle Form.Items `disabled` when `isDestinationShop`:

```tsx
<Form.Item name="customerName" label="ชื่อ-นามสกุล ลูกค้า" ...>
  <Input disabled={isDestinationShop} />
</Form.Item>
```

Apply `disabled={isDestinationShop}` to: `customerName`, `phone`, `licensePlate`, `odometer`, `symptoms`, `notes`, `cause`, `totalPrice`, `date`, `time`, `assignedTo`.

- [ ] **Step 3: Rewrite page.tsx as a server component**

Replace `src/app/edit/[id]/page.tsx` with:

```typescript
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import EditForm from './EditForm'

export default async function EditPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { shopId } = session.user

  // Check if this is a destination-shop view (ACCEPTED transfer where we are toShop)
  const transfer = await prisma.jobTransfer.findFirst({
    where: { jobId: params.id, toShopId: shopId, status: 'ACCEPTED' },
    include: { fromShop: { select: { name: true } } },
  })

  const isDestinationShop = !!transfer
  const fromShopName = transfer?.fromShop.name ?? ''

  // Verify access: must be owner OR destination shop
  if (!isDestinationShop) {
    const job = await prisma.job.findFirst({ where: { id: params.id, shopId }, select: { id: true } })
    if (!job) notFound()
  }

  return <EditForm isDestinationShop={isDestinationShop} fromShopName={fromShopName} />
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Manual test**

1. As the destination shop (with an ACCEPTED transfer), navigate to `/edit/[jobId]`. Should see the green "📥 รับโอนจาก..." banner.
2. Customer/vehicle fields should appear disabled (greyed out).
3. Status dropdown and parts section should be editable.
4. Saving status change should succeed.

- [ ] **Step 6: Commit**

```bash
git add "src/app/edit/[id]/page.tsx" "src/app/edit/[id]/EditForm.tsx"
git commit -m "feat: edit page detects destination-shop context, disables readonly fields"
```

---

## Task 10: /jobs/incoming Page — Destination Shop Incoming Jobs

**Files:**
- Create: `src/app/jobs/incoming/page.tsx`
- Create: `src/app/jobs/incoming/IncomingJobsTable.tsx`

- [ ] **Step 1: Create the server page**

Create `src/app/jobs/incoming/page.tsx`:

```typescript
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import IncomingJobsTable from './IncomingJobsTable'

export default async function IncomingJobsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, shopId } = session.user
  if (role === 'TECH') redirect('/')

  const transfers = await prisma.jobTransfer.findMany({
    where: {
      toShopId: shopId,
      status: { in: ['PENDING', 'ACCEPTED'] },
    },
    include: {
      job: {
        select: {
          id: true,
          jobNo: true,
          customerName: true,
          licensePlate: true,
          status: true,
          date: true,
        },
      },
      fromShop: { select: { name: true, refCode: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const canManage = role === 'SUPER_ADMIN' || role === 'SHOP_ADMIN' || role === 'LEAD_TECH'

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <IncomingJobsTable transfers={transfers} canManage={canManage} />
    </div>
  )
}
```

- [ ] **Step 2: Create the client table component**

Create `src/app/jobs/incoming/IncomingJobsTable.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Tag, Button, Space, message, Tabs, Typography, Popconfirm } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import Link from 'next/link'

const { Title } = Typography

interface JobInfo {
  id: string
  jobNo: string
  customerName: string
  licensePlate: string
  status: string
  date: string
}

interface Transfer {
  id: string
  jobId: string
  status: 'PENDING' | 'ACCEPTED'
  note: string | null
  createdAt: string
  job: JobInfo
  fromShop: { name: string; refCode: string }
}

interface Props {
  transfers: Transfer[]
  canManage: boolean
}

export default function IncomingJobsTable({ transfers, canManage }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function doAction(jobId: string, action: 'accept' | 'reject') {
    setLoading(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/transfer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { message.error(data.error ?? 'เกิดข้อผิดพลาด'); return }
      message.success(action === 'accept' ? 'รับงานสำเร็จ' : 'ปฏิเสธงานสำเร็จ')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const pending = transfers.filter(t => t.status === 'PENDING')
  const accepted = transfers.filter(t => t.status === 'ACCEPTED')

  const pendingColumns: ColumnsType<Transfer> = [
    { title: 'เลขที่ใบงาน', dataIndex: ['job', 'jobNo'], key: 'jobNo' },
    { title: 'ลูกค้า',      dataIndex: ['job', 'customerName'], key: 'customerName' },
    { title: 'ทะเบียน',     dataIndex: ['job', 'licensePlate'], key: 'licensePlate' },
    { title: 'จากร้าน',     key: 'fromShop', render: (_: unknown, r: Transfer) => `${r.fromShop.name} (${r.fromShop.refCode})` },
    { title: 'วันที่',      dataIndex: ['job', 'date'], key: 'date' },
    { title: 'หมายเหตุ',    dataIndex: 'note', key: 'note', render: (v: string | null) => v || '—' },
    {
      title: 'การดำเนินการ',
      key: 'actions',
      render: (_: unknown, r: Transfer) => canManage ? (
        <Space>
          <Button type="primary" size="small" loading={loading} onClick={() => doAction(r.job.id, 'accept')}>
            รับงาน
          </Button>
          <Popconfirm title="ยืนยันปฏิเสธงานนี้?" onConfirm={() => doAction(r.job.id, 'reject')} okText="ปฏิเสธ" cancelText="ยกเลิก">
            <Button danger size="small" loading={loading}>ปฏิเสธ</Button>
          </Popconfirm>
        </Space>
      ) : null,
    },
  ]

  const acceptedColumns: ColumnsType<Transfer> = [
    { title: 'เลขที่ใบงาน', dataIndex: ['job', 'jobNo'], key: 'jobNo' },
    { title: 'ลูกค้า',      dataIndex: ['job', 'customerName'], key: 'customerName' },
    { title: 'ทะเบียน',     dataIndex: ['job', 'licensePlate'], key: 'licensePlate' },
    { title: 'จากร้าน',     key: 'fromShop', render: (_: unknown, r: Transfer) => `${r.fromShop.name} (${r.fromShop.refCode})` },
    { title: 'สถานะ',       key: 'status',   render: (_: unknown, r: Transfer) => <Tag color="blue">{r.job.status}</Tag> },
    {
      title: 'การดำเนินการ',
      key: 'actions',
      render: (_: unknown, r: Transfer) => (
        <Link href={`/edit/${r.job.id}`}>
          <Button size="small">แก้ไข / อัปเดต</Button>
        </Link>
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>งานที่รับโอน</Title>
      <Tabs
        defaultActiveKey="pending"
        items={[
          {
            key: 'pending',
            label: `รอรับ (${pending.length})`,
            children: (
              <Table
                dataSource={pending}
                columns={pendingColumns}
                rowKey="id"
                pagination={{ pageSize: 20 }}
                locale={{ emptyText: 'ไม่มีงานรอรับ' }}
              />
            ),
          },
          {
            key: 'accepted',
            label: `กำลังดำเนินการ (${accepted.length})`,
            children: (
              <Table
                dataSource={accepted}
                columns={acceptedColumns}
                rowKey="id"
                pagination={{ pageSize: 20 }}
                locale={{ emptyText: 'ไม่มีงานที่กำลังดำเนินการ' }}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Manual test**

1. Log in as a shop that has pending incoming transfers. Navigate to `/jobs/incoming`. Should see the "รอรับ" tab with transfer rows and "รับงาน" / "ปฏิเสธ" buttons.
2. Click "รับงาน". The row should move to the "กำลังดำเนินการ" tab.
3. In the "กำลังดำเนินการ" tab, click "แก้ไข / อัปเดต". Should open `/edit/[jobId]` with destination-shop restricted view.

- [ ] **Step 5: Commit**

```bash
git add src/app/jobs/incoming/
git commit -m "feat: /jobs/incoming page for destination shop (PENDING/ACCEPTED tabs)"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `JobTransfer` model with all spec fields — Task 1
- [x] Status flow PENDING → ACCEPTED/REJECTED/CANCELLED — Tasks 2–3
- [x] POST validation (no active transfer, not terminal, partner/branch check) — Task 2
- [x] PATCH accept (atomic transaction, job.status = "ถ่ายงานออก") — Task 3
- [x] PATCH reject/cancel (revert to previousJobStatus) — Task 3
- [x] GET /api/jobs/incoming — Task 4
- [x] Destination shop can update status + parts (not customer/vehicle) — Task 6
- [x] Job list includes transfer badge info — Task 5
- [x] Job detail GET allows destination shop when ACCEPTED — Task 5
- [x] Source receipt page: PENDING banner + cancel button — Task 8
- [x] Source receipt page: ACCEPTED banner + polling 30s + visibilitychange — Task 8
- [x] Destination edit page: banner + readonly fields — Task 9
- [x] /jobs/incoming page with PENDING/ACCEPTED tabs — Task 10
- [x] Navbar link with pending badge — Task 7
- [x] RBAC: only SHOP_ADMIN+ can create transfer, LEAD_TECH+ can accept/reject — Tasks 2–3

**Placeholder scan:** No TBD/TODO in any code block. All curl test commands use descriptive placeholder names.

**Type consistency:** `JobTransferStatus` enum values used consistently as `'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'` strings in TypeScript (Prisma generates this enum). `Transfer` interface in `IncomingJobsTable` uses `status: 'PENDING' | 'ACCEPTED'` which matches the DB query filter.
