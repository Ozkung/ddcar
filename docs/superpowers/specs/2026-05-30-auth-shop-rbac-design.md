# Phase 1: Auth + Shop + RBAC — Design Spec

**Goal:** เพิ่มระบบ Authentication, Multi-shop, และ Role-Based Access Control ให้กับ DDReport

**Architecture:** NextAuth.js (Auth.js v5) Credentials provider + JWT session ใน httpOnly cookie, Prisma schema ใหม่สำหรับ Shop/User, Middleware ป้องกัน route ทุกเส้นตาม role

**Tech Stack:** Auth.js v5, bcryptjs, Prisma (PostgreSQL), Next.js Middleware

---

## 1. Database Schema

### Model ใหม่

```prisma
enum Role {
  SUPER_ADMIN
  SHOP_ADMIN
  LEAD_TECH
  TECH
}

model Shop {
  id        String   @id @default(cuid())
  refCode   String   @unique        // 5 ตัวอักษร A-Z0-9 generate อัตโนมัติ
  name      String
  parentId  String?                 // null = ร้านหลัก, มีค่า = สาขา
  parent    Shop?    @relation("ShopBranches", fields: [parentId], references: [id])
  branches  Shop[]   @relation("ShopBranches")
  users     User[]
  jobs      Job[]
  createdAt DateTime @default(now())
}

model User {
  id        String   @id @default(cuid())
  email     String
  password  String                  // bcrypt hash
  name      String
  role      Role
  isActive  Boolean  @default(true) // false = deactivated (ยังอยู่ใน DB แต่ login ไม่ได้)
  shopId    String
  shop      Shop     @relation(fields: [shopId], references: [id])
  jobs      Job[]    @relation("CreatedBy")
  createdAt DateTime @default(now())

  @@unique([email, shopId])         // email unique ต่อร้าน ไม่ใช่ global
}
```

### Model เดิมที่แก้

```prisma
model Job {
  // ... fields เดิม ...
  shopId    String                  // เพิ่มใหม่
  createdBy String                  // เพิ่มใหม่
  shop      Shop   @relation(fields: [shopId], references: [id])
  creator   User   @relation("CreatedBy", fields: [createdBy], references: [id])
}
```

---

## 2. Ref Code Generation

- รูปแบบ: ตัวอักษรใหญ่ + ตัวเลข 5 หลัก เช่น `A3K9M`, `DD001`
- Algorithm: random จาก charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (ตัดตัวที่สับสนออก เช่น O, 0, I, 1)
- ตรวจสอบ unique ก่อน save — retry ถ้าชน (โอกาสชนต่ำมากเพราะมี 32^5 = ~33M combination)
- function: `generateRefCode(): Promise<string>` ใน `src/lib/refCode.ts`

---

## 3. Auth Flow

### Bootstrap — `/setup`

เงื่อนไขเข้าถึง: `User` count ใน DB = 0 เท่านั้น (Middleware ตรวจ)

ขั้นตอน:
1. กรอกชื่อร้าน → ระบบ generate refCode อัตโนมัติ (แสดงให้เห็น)
2. กรอกชื่อ + email + password ของ Super Admin
3. กด Submit → สร้าง Shop + User(SUPER_ADMIN) พร้อมกัน
4. Redirect ไป `/login`

### Login — `/login`

Two-step form (single page, step เปลี่ยนด้วย state):

```
Step 1: กรอก Ref Code (5 หลัก)
  → POST /api/auth/verify-shop { refCode }
  → ถ้าเจอ: แสดงชื่อร้าน + ไปต่อ Step 2
  → ถ้าไม่เจอ: error "ไม่พบรหัสร้าน"

Step 2: กรอก Email + Password (พร้อมแสดงชื่อร้านด้านบน)
  → NextAuth signIn("credentials", { refCode, email, password })
  → bcrypt.compare(password, user.password)
  → ถ้าผ่าน: session + redirect "/"
  → ถ้าไม่ผ่าน: error "Email หรือ Password ไม่ถูกต้อง"
```

### Session Payload

```typescript
interface Session {
  user: {
    id: string
    name: string
    email: string
    role: Role
    shopId: string
    shopName: string
  }
}
```

Session strategy: `jwt` (ไม่ใช้ DB sessions), maxAge: 8 ชั่วโมง (ปิดท้ายวันทำงาน)

---

## 4. Middleware — `src/middleware.ts`

```
Request มา
  ↓
path = /setup ?
  → User count = 0 → ผ่าน
  → User count > 0 → redirect /login

path = /login หรือ /api/auth/* ?
  → ผ่านเสมอ

ไม่มี session ?
  → redirect /login

มี session แต่เข้า /admin/* ?
  → role ไม่ใช่ SUPER_ADMIN หรือ SHOP_ADMIN → redirect / (403)

ผ่านทุกเงื่อนไข → ไปต่อ
```

---

## 5. RBAC — Permission Matrix

| Action | SUPER_ADMIN | SHOP_ADMIN | LEAD_TECH | TECH |
|--------|:-----------:|:----------:|:---------:|:----:|
| สร้างร้านหลัก | ✅ | ❌ | ❌ | ❌ |
| สร้างสาขา | ✅ | ✅ | ❌ | ❌ |
| สร้าง/แก้ User | ✅ | ✅ (ร้านตัวเอง) | ❌ | ❌ |
| สร้างงานซ่อม | ✅ | ✅ | ✅ | ✅ |
| แก้ไขงานซ่อม | ✅ | ✅ | ✅ | ✅ (งานตัวเอง) |
| เปลี่ยนสถานะ | ✅ | ✅ | ✅ | ✅ (งานตัวเอง) |
| ดูรายงานทั้งหมด | ✅ | ✅ | ✅ | ❌ |
| ดู Analytics | ✅ | ✅ | ✅ | ❌ |
| Export ข้อมูล | ✅ | ✅ | ✅ | ❌ |

Permission check ทำที่ 2 จุด:
1. **Middleware** — block route ระดับ page (`/admin/*`, `/analytics`)
2. **API route** — ตรวจ session.role ทุก handler ก่อน query DB

---

## 6. หน้าที่ต้องสร้าง

### `/setup`
- Form: ชื่อร้าน, ชื่อ Admin, Email, Password, Confirm Password
- แสดง refCode ที่ generate ไว้ (preview ก่อน submit)
- Submit → POST `/api/setup`

### `/login`
- Two-step form ใน card เดียว
- Step 1: input Ref Code + ปุ่ม "ค้นหาร้าน"
- Step 2: แสดง shop name, input Email + Password + ปุ่ม Login
- ปุ่ม "เปลี่ยนร้าน" กลับ Step 1

### `/admin/shops`
- ตารางร้านทั้งหมด (SUPER_ADMIN เห็นทุกร้าน, SHOP_ADMIN เห็นแค่ร้านตัวเองและสาขา)
- แสดง: ชื่อร้าน, Ref Code, ประเภท (ร้านหลัก/สาขา), จำนวน User, วันที่สร้าง
- ปุ่ม "สร้างร้านใหม่" / "สร้างสาขา"

### `/admin/shops/new`
- Form: ชื่อร้าน, เลือก parent shop (ถ้าต้องการเป็นสาขา)
- Ref Code generate + แสดงอัตโนมัติ

### `/admin/users`
- ตาราง User ในร้าน (scoped by shopId)
- แสดง: ชื่อ, Email, Role, วันที่สร้าง
- ปุ่ม "สร้าง User", Edit, Deactivate

### `/admin/users/new` + `/admin/users/[id]/edit`
- Form: ชื่อ, Email, Role (dropdown), Password (new only)

---

## 7. API Routes ใหม่

```
POST /api/setup                    สร้าง Shop + SUPER_ADMIN ครั้งแรก
POST /api/auth/verify-shop         ตรวจ refCode → return shopName
GET  /api/admin/shops              รายการร้าน
POST /api/admin/shops              สร้างร้านใหม่/สาขา
GET  /api/admin/users              รายการ User ในร้านตัวเอง
POST /api/admin/users              สร้าง User ใหม่
PATCH /api/admin/users/[id]        แก้ไข User
DELETE /api/admin/users/[id]       ลบ User
```

---

## 8. แก้ไข Code เดิม

### API Routes ที่มีอยู่ — เพิ่ม scope

ทุก route ใน `/api/jobs/*` และ `/api/analytics` ต้องแก้:
```typescript
// Auth.js v5 — ใช้ auth() ไม่ใช่ getServerSession()
import { auth } from '@/auth'

const session = await auth()
if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
const { shopId, role } = session.user

// เพิ่ม where clause
where: { shopId, ...existingFilters }
```

### Job Create — เพิ่ม shopId + createdBy
```typescript
await prisma.job.create({
  data: { ...jobData, shopId: session.user.shopId, createdBy: session.user.id }
})
```

### Nav — แสดงชื่อ User + Role + ปุ่ม Logout

---

## 9. Migration Strategy

ข้อมูล Job เดิมใน DB ยังไม่มี `shopId` และ `createdBy`:
1. Migration เพิ่ม column `shopId` และ `createdBy` เป็น nullable ก่อน
2. Seed ข้อมูลเดิม: assign shopId = ร้านแรกที่สร้างตอน setup
3. Migration ครั้งที่ 2: เปลี่ยนเป็น NOT NULL

---

## 10. Dependencies ที่ต้องติดตั้ง

```bash
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

Auth.js v5 (beta) รองรับ Next.js 14 App Router native — ไม่ต้อง custom server
