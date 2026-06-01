# Job Transfer — Design Spec

**Goal:** ให้ร้านซ่อมโอนใบงานไปยังร้านพันธมิตรหรือสาขา โดยปลายทางรับงานและอัปเดตสถานะเอง ต้นทางเห็น progress real-time

**Architecture:** `JobTransfer` model แยกเก็บ metadata การโอน (pattern เดียวกับ `StockTransfer`). Job record อยู่ที่ต้นทาง สถานะเปลี่ยนเป็น "ถ่ายงานออก" เมื่อ ACCEPTED. ปลายทาง query งานผ่าน JobTransfer. Real-time ด้วย polling 30 วินาที + visibilitychange

**Tech Stack:** Next.js 14 App Router, Prisma (PostgreSQL), Ant Design 5, Auth.js v5

---

## 1. Database Schema

```prisma
enum JobTransferStatus {
  PENDING    // รอปลายทางกดรับ
  ACCEPTED   // ปลายทางรับแล้ว งานอยู่ที่ปลายทาง
  REJECTED   // ปฏิเสธ — job กลับสถานะเดิม
  CANCELLED  // ต้นทางยกเลิก (ก่อน ACCEPTED)
}

model JobTransfer {
  id                String            @id @default(cuid())
  jobId             String            @unique
  job               Job               @relation(fields: [jobId], references: [id], onDelete: Cascade)
  fromShopId        String
  toShopId          String
  fromShop          Shop              @relation("JobTransferFrom", fields: [fromShopId], references: [id])
  toShop            Shop              @relation("JobTransferTo", fields: [toShopId], references: [id])
  status            JobTransferStatus @default(PENDING)
  previousJobStatus String            // สถานะ job ก่อนโอน ไว้คืนเมื่อ REJECTED/CANCELLED
  requestedBy       String            // userId
  note              String?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([fromShopId])
  @@index([toShopId])
}
```

เพิ่มใน `model Job`:
```prisma
transfer JobTransfer?
```

เพิ่มใน `model Shop`:
```prisma
jobTransfersFrom JobTransfer[] @relation("JobTransferFrom")
jobTransfersTo   JobTransfer[] @relation("JobTransferTo")
```

---

## 2. Status Flow

```
ต้นทางสร้าง transfer (PENDING)
        │
        ├─→ ต้นทางกด "ยกเลิก"   → CANCELLED → job.status = previousJobStatus
        │
        ├─→ ปลายทาง "ปฏิเสธ"    → REJECTED  → job.status = previousJobStatus
        │
        └─→ ปลายทาง "รับงาน"    → ACCEPTED  → job.status = "ถ่ายงานออก"
                    │
                    └─→ ปลายทางอัปเดต job.status ตามปกติ
                        (ต้นทางเห็น real-time)
```

**Job statuses ที่ปลายทางอัปเดตได้หลัง ACCEPTED:**
- อยู่ระหว่างดำเนินการ
- ซ่อมเสร็จเรียบร้อยแล้ว
- ส่งมอบและเก็บเงินแล้ว
- ยกเลิกรายการแล้ว

**Validation ก่อนสร้าง transfer:**
- Job ต้องไม่มี active transfer อยู่แล้ว (PENDING หรือ ACCEPTED)
- Job status ต้องไม่ใช่ "ส่งมอบและเก็บเงินแล้ว" หรือ "ยกเลิกรายการแล้ว"
- toShopId ต้องเป็น partner (ACCEPTED) หรือสาขาในกลุ่มเดียวกัน (ตรวจเหมือน StockTransfer)

---

## 3. API Routes

### POST `/api/jobs/[id]/transfer`
สร้าง JobTransfer (PENDING)

**Auth:** SHOP_ADMIN, SUPER_ADMIN ของ fromShop เท่านั้น

**Request:**
```json
{ "toShopId": "clxxx", "note": "ส่งให้ช่างผู้เชี่ยวชาญ" }
```

**Logic:**
1. ตรวจ job เป็นของ shopId ของผู้เรียก
2. ตรวจ job ไม่มี active transfer
3. ตรวจ job status ไม่ใช่ terminal state
4. ตรวจ toShopId เป็น partner หรือสาขาในกลุ่ม
5. สร้าง JobTransfer (status=PENDING, previousJobStatus=job.status ปัจจุบัน)

---

### PATCH `/api/jobs/[id]/transfer`
รับ action: `accept` | `reject` | `cancel`

**accept** — ปลายทางกดรับ:
- ตรวจ transfer.toShopId === shopId ของผู้เรียก
- ตรวจ status === PENDING
- `transfer.status = ACCEPTED`, `job.status = "ถ่ายงานออก"`
- Atomic ใน transaction

**reject** — ปลายทางปฏิเสธ:
- ตรวจ transfer.toShopId === shopId
- ตรวจ status === PENDING
- `transfer.status = REJECTED`, `job.status = previousJobStatus`

**cancel** — ต้นทางยกเลิก:
- ตรวจ transfer.fromShopId === shopId หรือ SUPER_ADMIN
- ตรวจ status === PENDING (ยกเลิกหลัง ACCEPTED ไม่ได้)
- `transfer.status = CANCELLED`, `job.status = previousJobStatus`

---

### GET `/api/jobs/incoming`
รายการ JobTransfer ที่ `toShopId = shopId` พร้อม job details

**Auth:** SHOP_ADMIN, LEAD_TECH, SUPER_ADMIN

**Response:** รายการ grouped by status (PENDING / ACCEPTED)

---

### PATCH `/api/jobs/[id]` — ปลายทางอัปเดต job
เพิ่ม logic: ถ้า job มี transfer.status = ACCEPTED และ job.shopId ≠ shopId:
- อนุญาตให้ toShopId อัปเดต `status` และ `jobParts` ได้
- ห้ามแก้ข้อมูล customer/vehicle (customerName, phone, licensePlate, odometer, symptoms, cause, totalPrice)

---

## 4. Pages & UI

### หน้า Job List (`/`) — ต้นทาง
- ใบงานที่โอนออก: badge สีม่วง `ถ่ายงานออก` + RefCode ปลายทาง
- ใบงานที่รอปลายทางรับ: badge สีส้ม `รอรับงาน`

### หน้า Job Detail — ต้นทาง

**กรณี PENDING:**
```
┌─────────────────────────────────────────┐
│ ⏳ รอ [ชื่อร้านปลายทาง] กดรับงาน       │
│                          [ ยกเลิกการโอน ]│
└─────────────────────────────────────────┘
```

**กรณี ACCEPTED:**
```
┌─────────────────────────────────────────┐
│ 🔄 ถ่ายงานออกไปยัง [ชื่อร้าน] (REFXXX) │
│ สถานะปัจจุบัน: อยู่ระหว่างดำเนินการ    │
│ อัปเดตล่าสุด: 5 นาทีที่แล้ว            │
└─────────────────────────────────────────┘
```
- ข้อมูลทั้งหมด read-only
- Auto-refresh ทุก 30 วินาที + เมื่อ tab กลับมา active (visibilitychange)

### หน้า "งานที่รับโอน" `/jobs/incoming` — ปลายทาง

Tab **รอรับ (PENDING):**
| ใบงาน | จากร้าน | วันที่ | หมายเหตุ | actions |
|---|---|---|---|---|
| JOB-0042 | ร้าน A | 2 มิ.ย. | ส่งช่างผู้เชี่ยวชาญ | รับงาน / ปฏิเสธ |

Tab **กำลังดำเนินการ (ACCEPTED):**
| ใบงาน | จากร้าน | สถานะ | actions |
|---|---|---|---|
| JOB-0038 | ร้าน B | อยู่ระหว่างดำเนินการ | แก้ไข |

### หน้า Job Detail — ปลายทาง (ACCEPTED)
- Banner: `รับโอนจาก [ชื่อร้าน A]`
- อัปเดต status ได้
- เพิ่ม/ลบ parts จากคลังตัวเองได้
- ข้อมูล customer / vehicle / ราคาต้นฉบับ → read-only (greyed out)

---

## 5. Navigation

เพิ่มใน navbar: **"งานที่รับโอน"** แสดงเฉพาะ SHOP_ADMIN, LEAD_TECH, SUPER_ADMIN
- Badge แดงแสดงจำนวน PENDING transfers

---

## 6. RBAC

| Action | SUPER_ADMIN | SHOP_ADMIN | LEAD_TECH | TECH |
|---|:---:|:---:|:---:|:---:|
| โอนใบงานออก | ✅ | ✅ | ❌ | ❌ |
| ยกเลิกการโอน | ✅ | ✅ | ❌ | ❌ |
| รับงาน / ปฏิเสธ | ✅ | ✅ | ✅ | ❌ |
| อัปเดตสถานะงานที่รับโอน | ✅ | ✅ | ✅ | ❌ |
| เพิ่ม parts ในงานที่รับโอน | ✅ | ✅ | ✅ | ❌ |
| ดูหน้า incoming jobs | ✅ | ✅ | ✅ | ❌ |
