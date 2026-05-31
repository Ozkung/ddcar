# Phase 2A: Stock System + Job Form Improvements — Design Spec

**Goal:** เพิ่มระบบคลังอะไหล่ (Stock), ปรับปรุง Job Form (เลือกช่าง + สถานะใหม่ + อะไหล่), และระบบโอนอะไหล่ระหว่างสาขา

**Architecture:** Prisma schema ใหม่ 6 models, Next.js App Router pages, API routes เพิ่มเติม, stock deduction logic ผูกกับ job status transitions

**Tech Stack:** Next.js 14 App Router, Prisma (PostgreSQL), Ant Design 5, Auth.js v5

---

## 1. Database Schema

### Models ใหม่

```prisma
model StockItem {
  id            String           @id @default(cuid())
  shopId        String
  shop          Shop             @relation(fields: [shopId], references: [id])
  name          String
  category      String           // น้ำมัน | ยาง | ไฟฟ้า | ช่วงล่าง | อื่นๆ
  unit          String           // ชิ้น | ลิตร | กก. | ม้วน
  quantity      Float            // จำนวนคงเหลือจริง
  reserved      Float            @default(0)   // ตัดหลอก (งาน in-progress)
  costPrice     Float
  supplierPhone String?          // เบอร์ร้านอะไหล่ (optional)
  warrantyStart DateTime?        // วันเริ่มรับประกัน (optional)
  warrantyEnd   DateTime?        // วันหมดรับประกัน (optional)
  createdAt     DateTime         @default(now())
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
  delta       Float     // + รับ / - ตัด
  reason      String    // "รับของ" | "ตัดของหาย" | "ปรับปรุงยอด" | "job:<id>" | "transfer:<id>"
  userId      String
  createdAt   DateTime  @default(now())
}

enum TransferStatus {
  PENDING      // รอ approve (partner sale เท่านั้น)
  IN_TRANSIT   // ของกำลังเดินทาง
  DELIVERED    // ปลายทางยืนยันรับแล้ว
  DISPUTED     // ร้องขอ — ของยังไม่ถึง
  REJECTED     // ปฏิเสธ (partner sale เท่านั้น)
  CANCELLED
}

model StockTransfer {
  id           String              @id @default(cuid())
  type         String              // "BRANCH" | "PARTNER_SALE"
  fromShopId   String
  toShopId     String
  fromShop     Shop                @relation("TransferFrom", fields: [fromShopId], references: [id])
  toShop       Shop                @relation("TransferTo", fields: [toShopId], references: [id])
  status       TransferStatus      @default(PENDING)
  deliveryDate DateTime            // วันที่คาดว่าของจะถึง
  receivedAt   DateTime?           // วันที่ปลายทางยืนยัน
  unitPrice    Float?              // null = branch transfer (ฟรี), set = partner sale
  note         String?
  requestedBy  String              // userId
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
  raisedBy   String        // userId
  message    String
  createdAt  DateTime      @default(now())
}
```

### Models เดิมที่แก้

```prisma
model Job {
  // ... fields เดิม ...
  assignedTo   String?    // userId ช่างที่รับงาน (optional)
  stockStatus  String     @default("none")  // none | reserved | deducted
  assignedUser User?      @relation("AssignedJobs", fields: [assignedTo], references: [id])
  jobParts     JobPart[]
}

model User {
  // ... fields เดิม ...
  assignedJobs Job[]      @relation("AssignedJobs")
}

model Shop {
  // ... fields เดิม ...
  stockItems      StockItem[]
  transfersFrom   StockTransfer[] @relation("TransferFrom")
  transfersTo     StockTransfer[] @relation("TransferTo")
}
```

---

## 2. Job Status ใหม่

สถานะงานทั้งหมด (เพิ่ม 2 ตัว):

```typescript
const JOB_STATUSES = [
  'ลูกค้าอนุมัติซ่อมแล้ว',
  'อยู่ระหว่างดำเนินการ',   // ← ใหม่ — trigger soft stock deduction
  'ซ่อมเสร็จเรียบร้อยแล้ว',
  'ส่งมอบและเก็บเงินแล้ว',  // ← trigger real stock deduction
  'ยกเลิกรายการแล้ว',       // ← ใหม่ — release soft deduction
]
```

---

## 3. Stock Deduction Logic

เมื่อ job status เปลี่ยน ระบบตรวจ `stockStatus` ของ job และ jobParts:

| สถานะใหม่ | stockStatus ก่อน | action |
|-----------|-----------------|--------|
| อยู่ระหว่างดำเนินการ | `none` | `reserved += qty` ทุก part → `stockStatus = "reserved"` |
| ส่งมอบและเก็บเงินแล้ว | `reserved` | `quantity -= qty`, `reserved -= qty` → `stockStatus = "deducted"` |
| ยกเลิกรายการแล้ว | `reserved` | `reserved -= qty` → `stockStatus = "none"` |
| ยกเลิกรายการแล้ว | `none` หรือ `deducted` | ไม่ทำอะไรกับ stock |

Logic นี้รันใน `PATCH /api/jobs/[id]` เมื่อ field `status` เปลี่ยน โดยใช้ Prisma transaction

---

## 4. Transfer Stock Logic

**Branch Transfer:**
1. SHOP_ADMIN/SUPER_ADMIN สร้าง transfer → `status = IN_TRANSIT` ทันที (ไม่ต้อง approve)
2. `fromShop.stockItem.reserved += qty` (ตัดหลอก)
3. ปลายทางยืนยันรับ → `status = DELIVERED`
4. `fromShop.stockItem.quantity -= qty`, `reserved -= qty`
5. ปลายทาง: หากมี StockItem ชื่อเดิม → `quantity += qty`, ไม่มี → สร้างใหม่ (copy name/category/unit)

**เมื่อ REJECTED หรือ CANCELLED:**
- `fromShop.stockItem.reserved -= qty` คืนกลับ

**Dispute:** ปลายทางกด "ร้องขอ" → สร้าง `TransferDispute` + `status = DISPUTED` — ต้นทางต้องติดต่อแก้ไขเอง (ไม่มี automated resolution)

ทุกการเปลี่ยน qty insert `StockAdjustLog` พร้อม reason เช่น `"transfer:clxxx"`

---

## 5. Job Form — 6 Steps

| Step | ชื่อ | Field ใหม่/เปลี่ยน |
|------|------|-------------------|
| 1 | เบื้องต้น | + `assignedTo` dropdown (TECH/LEAD_TECH ในร้าน) — optional |
| 2 | ลูกค้า/รถ | เหมือนเดิม |
| 3 | อาการ | เหมือนเดิม |
| 4 | ผล/ราคา | อัปเดต STATUSES array (เพิ่ม 2 ตัว) |
| 5 | **อะไหล่** ← ใหม่ | เลือกจาก stock ของร้าน + qty (optional ทั้ง step) |
| 6 | รูปภาพ | เหมือนเดิม |

**Step 5 อะไหล่:**
- Fetch `/api/stock?available=true` (qty > 0)
- แสดง: ชื่อ, หมวดหมู่, พร้อมใช้ = `quantity - reserved`
- เลือกรายการ + ระบุจำนวน ≤ พร้อมใช้
- ถ้าไม่เลือกอะไหล่ = `jobParts = []` (งานไม่ต้องใช้อะไหล่)

**หน้า Edit งาน** (`/edit/[id]`)ปรับตาม:
- เพิ่ม technician dropdown
- อัปเดต status options
- แสดง/แก้ไข parts list (ถ้า stockStatus = "none" เท่านั้น — ถ้า reserved/deducted แล้วไม่ให้แก้)

---

## 6. Stock Management Pages

### `/stock`
- ตารางอะไหล่ทั้งหมดของร้าน
- คอลัมน์: ชื่อ, หมวดหมู่, คงเหลือ, จอง, **พร้อมใช้** (`quantity - reserved`), ราคาทุน, วันหมดประกัน
- สีแดงถ้าพร้อมใช้ < 5 / สีส้มถ้าประกันหมดใน 30 วัน
- ปุ่ม: เพิ่มอะไหล่, ปรับยอด, แก้ไข

### `/stock/new`
Form: ชื่อ, หมวดหมู่, หน่วย, จำนวน, ราคาทุน, เบอร์ร้านอะไหล่ (opt), วันเริ่ม/หมดประกัน (opt)

### `/stock/[id]/edit`
แก้ไขข้อมูลอะไหล่ (ไม่ใช่ปรับ qty)

### `/stock/[id]/adjust`
ปรับ qty: ระบุ delta (+/-) + เหตุผล (รับของ / ตัดของหาย / ปรับปรุงยอด)

### `/stock/transfers`
Tab: **โอนภายใน (สาขา)** (Spec 2A) | ขายพันธมิตร (Spec 2B)
- แสดง: ต้นทาง → ปลายทาง, สถานะ, วันส่งถึง, รายการของ
- ปุ่ม: ยืนยันรับ (ฝั่งปลายทาง), ร้องขอ (ฝั่งปลายทาง เมื่อของไม่ถึง)

### `/stock/transfers/new`
- เลือกสาขาปลายทาง (branches ของร้านเท่านั้น)
- เลือกอะไหล่ + จำนวน (หลายรายการ)
- ระบุวันที่ส่งถึง

---

## 7. API Routes ใหม่

```
GET  /api/stock                       รายการ stock ของร้าน (query: ?available=true)
POST /api/stock                       สร้าง stock item
GET  /api/stock/[id]                  ดูรายละเอียด + adjust logs
PATCH /api/stock/[id]                 แก้ไขข้อมูล (ไม่ใช่ qty)
POST /api/stock/[id]/adjust           ปรับ qty + บันทึก log
GET  /api/stock/transfers             รายการ transfer (query: ?type=BRANCH)
POST /api/stock/transfers             สร้าง branch transfer
PATCH /api/stock/transfers/[id]       อัปเดตสถานะ (DELIVERED, CANCELLED)
POST /api/stock/transfers/[id]/dispute  ร้องขอ
```

---

## 8. RBAC

| Action | SUPER_ADMIN | SHOP_ADMIN | LEAD_TECH | TECH |
|--------|:-----------:|:----------:|:---------:|:----:|
| ดูรายการ stock | ✅ | ✅ | ✅ | ❌ |
| สร้าง/แก้ไข stock item | ✅ | ✅ | ❌ | ❌ |
| ปรับ qty manual | ✅ | ✅ | ❌ | ❌ |
| โอนอะไหล่ (branch) | ✅ | ✅ | ❌ | ❌ |
| ยืนยันรับของ | ✅ | ✅ | ✅ | ❌ |
| ร้องขอ (dispute) | ✅ | ✅ | ✅ | ❌ |
| เลือกอะไหล่ใน job form | ✅ | ✅ | ✅ | ✅ |

Navigation: เพิ่ม "คลังอะไหล่" ใน nav bar — แสดงเฉพาะ SUPER_ADMIN, SHOP_ADMIN, LEAD_TECH

---

## 9. Migration

- Models ใหม่ทั้งหมด → ไม่กระทบ data เดิม
- `Job.assignedTo` → nullable, ปลอดภัย
- `Job.stockStatus` → default `"none"`, ปลอดภัย
- Run: `prisma migrate dev --name add-stock-system`
