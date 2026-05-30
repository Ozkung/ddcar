# Phase 1: Auth + Shop + RBAC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มระบบ Login (Ref Code + Email + Password), Multi-shop, และ RBAC (4 fixed roles) ให้กับ DDReport

**Architecture:** Auth.js v5 (next-auth@beta) Credentials provider + JWT httpOnly cookie. Middleware ป้องกัน route ทุกเส้น. Schema เพิ่ม Shop + User models และ Role enum. ข้อมูล Job scoped ตาม shopId.

**Tech Stack:** next-auth@beta, bcryptjs, Prisma (PostgreSQL), Next.js Middleware, Ant Design 5

---

## File Map

**สร้างใหม่:**
- `src/lib/refCode.ts` — generateRefCode() utility
- `src/lib/__tests__/refCode.test.ts` — tests
- `src/auth.ts` — Auth.js v5 config (providers, callbacks, session)
- `src/types/next-auth.d.ts` — TypeScript type augmentation
- `src/middleware.ts` — route protection middleware
- `src/app/api/auth/[...nextauth]/route.ts` — Auth.js catch-all handler
- `src/app/api/setup/route.ts` — bootstrap endpoint
- `src/app/api/auth/verify-shop/route.ts` — lookup shop by refCode
- `src/app/api/admin/shops/route.ts` — CRUD shops
- `src/app/api/admin/users/route.ts` — CRUD users
- `src/app/api/admin/users/[id]/route.ts` — update/delete user
- `src/app/setup/page.tsx` — bootstrap server component
- `src/app/setup/SetupForm.tsx` — bootstrap client form
- `src/app/login/page.tsx` — login server component
- `src/app/login/LoginForm.tsx` — two-step login client form
- `src/app/admin/shops/page.tsx` — shop list
- `src/app/admin/shops/new/page.tsx` — create shop form
- `src/app/admin/users/page.tsx` — user list
- `src/app/admin/users/new/page.tsx` — create user form
- `src/app/admin/users/[id]/edit/page.tsx` — edit user form
- `src/app/UserNav.tsx` — client component: user info + logout dropdown

**แก้ไข:**
- `prisma/schema.prisma` — add Role enum, Shop, User; modify Job
- `package.json` — add next-auth@beta, bcryptjs
- `src/app/layout.tsx` — add auth, SessionProvider, UserNav, admin link
- `src/app/api/jobs/route.ts` — scope by shopId
- `src/app/api/jobs/[id]/route.ts` — scope by shopId
- `src/app/api/jobs/[id]/images/route.ts` — add auth guard
- `src/app/api/jobs/export/route.ts` — scope by shopId
- `src/app/api/analytics/route.ts` — scope by shopId
- `docker-compose.yml` — add AUTH_SECRET env

---

## Task 1: Install Dependencies + Prisma Schema

**Files:**
- Modify: `package.json`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Install packages**

```bash
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

Expected: `package.json` เพิ่ม `"next-auth": "^5.x.x-beta.x"` และ `"bcryptjs"`

- [ ] **Step 2: Replace prisma/schema.prisma**

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

model Shop {
  id        String   @id @default(cuid())
  refCode   String   @unique
  name      String
  parentId  String?
  parent    Shop?    @relation("ShopBranches", fields: [parentId], references: [id])
  branches  Shop[]   @relation("ShopBranches")
  users     User[]
  jobs      Job[]
  createdAt DateTime @default(now())
}

model User {
  id          String   @id @default(cuid())
  email       String
  password    String
  name        String
  role        Role
  isActive    Boolean  @default(true)
  shopId      String
  shop        Shop     @relation(fields: [shopId], references: [id])
  createdJobs Job[]    @relation("CreatedBy")
  createdAt   DateTime @default(now())

  @@unique([email, shopId])
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
  shopId       String?
  createdBy    String?
  shop         Shop?    @relation(fields: [shopId], references: [id])
  creator      User?    @relation("CreatedBy", fields: [createdBy], references: [id])
  createdAt    DateTime @default(now())
  images       Image[]
}

model Image {
  id        String   @id @default(cuid())
  jobId     String
  filename  String
  createdAt DateTime @default(now())
  job       Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
}
```

- [ ] **Step 3: Generate Prisma migration**

```bash
npx prisma migrate dev --name add-auth-shop-rbac
```

Expected: สร้าง `prisma/migrations/..._add_auth_shop_rbac/migration.sql` และ regenerate Prisma client

- [ ] **Step 4: Verify Prisma client ถูก generate**

```bash
npx prisma generate
```

Expected: ไม่มี error, output แสดง `Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
git add prisma/ package.json package-lock.json
git commit -m "feat: add Shop, User, Role to prisma schema"
```

---

## Task 2: generateRefCode Utility + Tests

**Files:**
- Create: `src/lib/refCode.ts`
- Create: `src/lib/__tests__/refCode.test.ts`

- [ ] **Step 1: Write the failing test**

สร้าง `src/lib/__tests__/refCode.test.ts`:

```typescript
jest.mock('@/lib/prisma', () => ({
  prisma: {
    shop: {
      findUnique: jest.fn(),
    },
  },
}))

import { generateRefCode } from '@/lib/refCode'
import { prisma } from '@/lib/prisma'

const mockFindUnique = prisma.shop.findUnique as jest.Mock

describe('generateRefCode', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns a 5-character code with valid charset', async () => {
    mockFindUnique.mockResolvedValue(null)
    const code = await generateRefCode()
    expect(code).toHaveLength(5)
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/)
  })

  it('retries when generated code is already taken', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null)
    const code = await generateRefCode()
    expect(code).toHaveLength(5)
    expect(mockFindUnique).toHaveBeenCalledTimes(2)
  })

  it('throws after max retries are exhausted', async () => {
    mockFindUnique.mockResolvedValue({ id: 'existing' })
    await expect(generateRefCode(3)).rejects.toThrow(
      'Failed to generate unique ref code'
    )
  })

  it('only uses characters from the safe charset (no O, 0, I, 1)', async () => {
    mockFindUnique.mockResolvedValue(null)
    for (let i = 0; i < 20; i++) {
      const code = await generateRefCode()
      expect(code).not.toMatch(/[O0I1]/)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- refCode --no-coverage
```

Expected: FAIL with `Cannot find module '@/lib/refCode'`

- [ ] **Step 3: Create src/lib/refCode.ts**

```typescript
import { prisma } from './prisma'

// Charset excludes visually confusing characters: O (oh), 0 (zero), I (eye), 1 (one)
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode(): string {
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return code
}

export async function generateRefCode(maxRetries = 10): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const code = randomCode()
    const existing = await prisma.shop.findUnique({ where: { refCode: code } })
    if (!existing) return code
  }
  throw new Error('Failed to generate unique ref code after max retries')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- refCode --no-coverage
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/refCode.ts src/lib/__tests__/refCode.test.ts
git commit -m "feat: add generateRefCode utility with tests"
```

---

## Task 3: Auth.js v5 Config + TypeScript Types

**Files:**
- Create: `src/auth.ts`
- Create: `src/types/next-auth.d.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create src/types/next-auth.d.ts**

```typescript
import type { DefaultSession } from 'next-auth'
import type { Role } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
      shopId: string
      shopName: string
    } & DefaultSession['user']
  }

  interface User {
    role: Role
    shopId: string
    shopName: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
    shopId: string
    shopName: string
  }
}
```

- [ ] **Step 2: Create src/auth.ts**

```typescript
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import type { Role } from '@prisma/client'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        refCode: {},
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const { refCode, email, password } = credentials as {
          refCode: string
          email: string
          password: string
        }
        if (!refCode || !email || !password) return null

        const shop = await prisma.shop.findUnique({
          where: { refCode: refCode.toUpperCase() },
        })
        if (!shop) return null

        const user = await prisma.user.findUnique({
          where: { email_shopId: { email, shopId: shop.id } },
        })
        if (!user || !user.isActive) return null

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          shopId: user.shopId,
          shopName: shop.name,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id       = user.id!
        token.role     = (user as any).role as Role
        token.shopId   = (user as any).shopId as string
        token.shopName = (user as any).shopName as string
      }
      return token
    },
    session({ session, token }) {
      session.user.id       = token.id
      session.user.role     = token.role
      session.user.shopId   = token.shopId
      session.user.shopName = token.shopName
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
})
```

- [ ] **Step 3: Create src/app/api/auth/[...nextauth]/route.ts**

```typescript
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 4: Add AUTH_SECRET to .env (local dev)**

Generate a secret:
```bash
openssl rand -base64 32
```

เพิ่มใน `.env` (สร้างถ้ายังไม่มี):
```
AUTH_SECRET=<paste-generated-value-here>
```

> `.env` อยู่ใน `.gitignore` แล้ว — ไม่ต้อง commit

- [ ] **Step 5: ตรวจสอบ build ไม่ error**

```bash
npm run build 2>&1 | tail -15
```

Expected: build สำเร็จ ไม่มี TypeScript error เกี่ยวกับ auth

- [ ] **Step 6: Commit**

```bash
git add src/auth.ts src/types/ "src/app/api/auth/[...nextauth]/"
git commit -m "feat: add Auth.js v5 config and TypeScript types"
```

---

## Task 4: Next.js Middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create src/middleware.ts**

```typescript
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // ── Public paths — always allow ──────────────────────────────────────
  const isPublic =
    pathname === '/login' ||
    pathname === '/setup' ||
    pathname === '/offline' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/setup')

  if (isPublic) return NextResponse.next()

  // ── No session → redirect to login ───────────────────────────────────
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const role = session.user.role

  // ── /admin/* → SUPER_ADMIN or SHOP_ADMIN only ─────────────────────────
  if (pathname.startsWith('/admin')) {
    if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  // ── /analytics → not TECH ─────────────────────────────────────────────
  if (pathname.startsWith('/analytics') && role === 'TECH') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icon-|apple-touch|manifest\\.json|sw\\.js|workbox).*)',
  ],
}
```

- [ ] **Step 2: ตรวจสอบ build ไม่ error**

```bash
npm run build 2>&1 | grep -E "(error|Error|✓)" | head -10
```

Expected: build pass หรือ error เฉพาะ unrelated warnings

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add Next.js middleware for route protection"
```

---

## Task 5: Setup API

**Files:**
- Create: `src/app/api/setup/route.ts`

- [ ] **Step 1: Create src/app/api/setup/route.ts**

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generateRefCode } from '@/lib/refCode'

export async function POST(req: NextRequest) {
  // Block if already set up
  const count = await prisma.user.count()
  if (count > 0) {
    return Response.json({ error: 'Setup already completed' }, { status: 403 })
  }

  const body = await req.json()
  const { shopName, adminName, adminEmail, adminPassword } = body

  if (!shopName?.trim() || !adminName?.trim() || !adminEmail?.trim() || !adminPassword) {
    return Response.json({ error: 'Missing required fields' }, { status: 422 })
  }

  if (adminPassword.length < 8) {
    return Response.json({ error: 'Password ต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 422 })
  }

  const refCode = await generateRefCode()
  const hashedPassword = await bcrypt.hash(adminPassword, 12)

  // Create shop + super admin in one transaction
  // Also migrate any existing jobs (shopId = null) to this shop
  const result = await prisma.$transaction(async (tx) => {
    const shop = await tx.shop.create({
      data: {
        refCode,
        name: shopName.trim(),
        users: {
          create: {
            email: adminEmail.trim().toLowerCase(),
            password: hashedPassword,
            name: adminName.trim(),
            role: 'SUPER_ADMIN',
            isActive: true,
          },
        },
      },
      include: { users: true },
    })

    // Assign pre-existing jobs (before auth was added) to this shop
    await tx.job.updateMany({
      where: { shopId: null },
      data: { shopId: shop.id, createdBy: shop.users[0].id },
    })

    return shop
  })

  return Response.json(
    { shopName: result.name, refCode: result.refCode },
    { status: 201 }
  )
}
```

- [ ] **Step 2: Test setup API manually (docker must be running)**

```bash
curl -s -X POST http://localhost/api/setup \
  -H "Content-Type: application/json" \
  -d '{"shopName":"ดีดีช่างยนต์","adminName":"Admin","adminEmail":"admin@dd.com","adminPassword":"password123"}' \
  | python3 -m json.tool
```

Expected:
```json
{
  "shopName": "ดีดีช่างยนต์",
  "refCode": "XXXXX"
}
```

- [ ] **Step 3: Verify calling setup again returns 403**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost/api/setup \
  -H "Content-Type: application/json" \
  -d '{"shopName":"x","adminName":"x","adminEmail":"x@x.com","adminPassword":"12345678"}'
```

Expected: `403`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/setup/
git commit -m "feat: add setup bootstrap API endpoint"
```

---

## Task 6: Setup Page + Form

**Files:**
- Create: `src/app/setup/page.tsx`
- Create: `src/app/setup/SetupForm.tsx`

- [ ] **Step 1: Create src/app/setup/page.tsx**

```typescript
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SetupForm from './SetupForm'

export default async function SetupPage() {
  const count = await prisma.user.count()
  if (count > 0) redirect('/login')

  return <SetupForm />
}
```

- [ ] **Step 2: Create src/app/setup/SetupForm.tsx**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, Typography, Alert } from 'antd'
import { ShopOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export default function SetupForm() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ refCode: string; shopName: string } | null>(null)

  async function onFinish(values: {
    shopName: string
    adminName: string
    adminEmail: string
    adminPassword: string
    confirmPassword: string
  }) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: values.shopName,
          adminName: values.adminName,
          adminEmail: values.adminEmail,
          adminPassword: values.adminPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setDone(data)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f1f5f9' }}>
        <Card style={{ width: 480, textAlign: 'center' }}>
          <ShopOutlined style={{ fontSize: 48, color: '#2563eb', marginBottom: 16 }} />
          <Title level={3}>ตั้งค่าระบบสำเร็จ! ✅</Title>
          <Text>ร้าน: <strong>{done.shopName}</strong></Text>
          <br /><br />
          <Alert
            message={
              <>
                รหัสร้านของคุณ:{' '}
                <strong style={{ fontSize: 24, letterSpacing: 6, fontFamily: 'monospace' }}>
                  {done.refCode}
                </strong>
              </>
            }
            description="📌 บันทึกรหัสนี้ไว้ — จำเป็นสำหรับการ Login ทุกครั้ง"
            type="warning"
            showIcon
            style={{ marginBottom: 24, textAlign: 'left' }}
          />
          <Button type="primary" size="large" onClick={() => router.push('/login')}>
            ไปหน้า Login
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f1f5f9' }}>
      <Card style={{ width: 480 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 4 }}>
          🔧 ตั้งค่าระบบครั้งแรก
        </Title>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
          สร้างร้านและผู้ดูแลระบบ (Super Admin)
        </Text>

        {error && (
          <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
        )}

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="ชื่อร้าน"
            name="shopName"
            rules={[{ required: true, message: 'กรุณากรอกชื่อร้าน' }]}
          >
            <Input placeholder="เช่น ดีดีช่างยนต์" size="large" />
          </Form.Item>

          <Form.Item
            label="ชื่อ Admin"
            name="adminName"
            rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}
          >
            <Input placeholder="ชื่อ-นามสกุล" size="large" />
          </Form.Item>

          <Form.Item
            label="Email"
            name="adminEmail"
            rules={[{ required: true, type: 'email', message: 'กรุณากรอก Email ที่ถูกต้อง' }]}
          >
            <Input placeholder="admin@example.com" size="large" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="adminPassword"
            rules={[{ required: true, min: 8, message: 'Password ต้องมีอย่างน้อย 8 ตัวอักษร' }]}
          >
            <Input.Password placeholder="อย่างน้อย 8 ตัวอักษร" size="large" />
          </Form.Item>

          <Form.Item
            label="ยืนยัน Password"
            name="confirmPassword"
            dependencies={['adminPassword']}
            rules={[
              { required: true, message: 'กรุณายืนยัน Password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('adminPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Password ไม่ตรงกัน'))
                },
              }),
            ]}
          >
            <Input.Password size="large" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading} block size="large">
            สร้างระบบ
          </Button>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: ทดสอบ reset DB แล้วเปิด http://localhost/setup**

```bash
# Reset DB เพื่อทดสอบ setup flow (ระวัง: ลบข้อมูลทั้งหมด)
docker compose exec app npx prisma migrate reset --force
```

เปิด `http://localhost/setup` → กรอกข้อมูล → ตรวจสอบว่า redirect ไป /login

- [ ] **Step 4: Commit**

```bash
git add src/app/setup/
git commit -m "feat: add setup page and form for first-time bootstrap"
```

---

## Task 7: verify-shop API + Login Page + Form

**Files:**
- Create: `src/app/api/auth/verify-shop/route.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/LoginForm.tsx`

- [ ] **Step 1: Create src/app/api/auth/verify-shop/route.ts**

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const refCode = String(body.refCode || '').toUpperCase().trim()

  if (!refCode || refCode.length !== 5) {
    return Response.json({ error: 'รหัสร้านต้องมี 5 หลัก' }, { status: 422 })
  }

  const shop = await prisma.shop.findUnique({
    where: { refCode },
    select: { name: true },
  })

  if (!shop) {
    return Response.json({ error: 'ไม่พบรหัสร้านนี้ในระบบ' }, { status: 404 })
  }

  return Response.json({ shopName: shop.name })
}
```

- [ ] **Step 2: Create src/app/login/page.tsx**

```typescript
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect('/')

  const count = await prisma.user.count()
  if (count === 0) redirect('/setup')

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f1f5f9',
      }}
    >
      <LoginForm />
    </div>
  )
}
```

- [ ] **Step 3: Create src/app/login/LoginForm.tsx**

```typescript
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, Typography, Alert } from 'antd'
import { ShopOutlined, LockOutlined } from '@ant-design/icons'

const { Title } = Typography

export default function LoginForm() {
  const router = useRouter()
  const [step, setStep] = useState<0 | 1>(0)
  const [refCode, setRefCode] = useState('')
  const [shopName, setShopName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form1] = Form.useForm()
  const [form2] = Form.useForm()

  async function onVerifyShop({ code }: { code: string }) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/verify-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refCode: code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setRefCode(code.toUpperCase())
      setShopName(data.shopName)
      setStep(1)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  async function onLogin({ email, password }: { email: string; password: string }) {
    setLoading(true)
    setError(null)
    const result = await signIn('credentials', {
      refCode,
      email,
      password,
      redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError('Email หรือ Password ไม่ถูกต้อง')
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <Card style={{ width: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 32, marginBottom: 4 }}>🔧</div>
        <Title level={3} style={{ margin: 0 }}>DDReport</Title>
      </div>

      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
      )}

      {step === 0 && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 20, color: '#64748b' }}>
            <ShopOutlined style={{ marginRight: 6 }} />
            กรอกรหัสร้านของคุณ
          </div>
          <Form form={form1} layout="vertical" onFinish={onVerifyShop}>
            <Form.Item
              name="code"
              rules={[
                { required: true, message: 'กรุณากรอกรหัสร้าน' },
                { len: 5, message: 'รหัสร้านต้องมี 5 หลัก' },
              ]}
            >
              <Input
                placeholder="เช่น A3K9M"
                maxLength={5}
                size="large"
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: 8,
                  fontSize: 22,
                  textAlign: 'center',
                  fontFamily: 'monospace',
                }}
                onChange={(e) =>
                  form1.setFieldValue('code', e.target.value.toUpperCase())
                }
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              ค้นหาร้าน
            </Button>
          </Form>
        </>
      )}

      {step === 1 && (
        <>
          <Alert
            message={
              <>
                ร้าน:{' '}
                <strong>{shopName}</strong>
                <Button
                  size="small"
                  type="link"
                  style={{ float: 'right', padding: 0 }}
                  onClick={() => {
                    setStep(0)
                    setError(null)
                    form2.resetFields()
                  }}
                >
                  เปลี่ยนร้าน
                </Button>
              </>
            }
            type="success"
            style={{ marginBottom: 20 }}
          />
          <div style={{ textAlign: 'center', marginBottom: 20, color: '#64748b' }}>
            <LockOutlined style={{ marginRight: 6 }} />
            กรอก Email และ Password
          </div>
          <Form form={form2} layout="vertical" onFinish={onLogin}>
            <Form.Item
              label="Email"
              name="email"
              rules={[{ required: true, type: 'email', message: 'กรุณากรอก Email' }]}
            >
              <Input size="large" autoFocus />
            </Form.Item>
            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: 'กรุณากรอก Password' }]}
            >
              <Input.Password size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              เข้าสู่ระบบ
            </Button>
          </Form>
        </>
      )}
    </Card>
  )
}
```

- [ ] **Step 4: ทดสอบ login flow**

1. เปิด `http://localhost` → ต้อง redirect ไป `/login`
2. กรอก Ref Code ผิด → เห็น error "ไม่พบรหัสร้านนี้"
3. กรอก Ref Code ถูก → เห็นชื่อร้าน
4. กรอก email/password ถูก → redirect ไปหน้าหลัก
5. กรอก password ผิด → เห็น error

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/verify-shop/ src/app/login/
git commit -m "feat: add verify-shop API and login page with two-step form"
```

---

## Task 8: Update layout.tsx — Session-Aware Nav

**Files:**
- Create: `src/app/UserNav.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create src/app/UserNav.tsx**

```typescript
'use client'

import { signOut } from 'next-auth/react'
import { Button, Dropdown } from 'antd'
import { UserOutlined, LogoutOutlined } from '@ant-design/icons'
import type { Role } from '@prisma/client'

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  SHOP_ADMIN:  'Shop Admin',
  LEAD_TECH:   'หัวหน้าช่าง',
  TECH:        'ช่าง',
}

interface Props {
  name: string
  role: Role
  shopName: string
}

export function UserNav({ name, role, shopName }: Props) {
  return (
    <Dropdown
      menu={{
        items: [
          {
            key: 'info',
            label: (
              <div style={{ padding: '4px 0' }}>
                <div style={{ fontWeight: 600 }}>{name}</div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>{shopName}</div>
                <div style={{ color: '#2563eb', fontSize: 12 }}>{ROLE_LABELS[role]}</div>
              </div>
            ),
            disabled: true,
          },
          { type: 'divider' },
          {
            key: 'logout',
            label: 'ออกจากระบบ',
            icon: <LogoutOutlined />,
            danger: true,
            onClick: () => signOut({ callbackUrl: '/login' }),
          },
        ],
      }}
    >
      <Button
        type="text"
        icon={<UserOutlined />}
        style={{ color: 'rgba(255,255,255,0.85)' }}
      >
        {name}
      </Button>
    </Dropdown>
  )
}
```

- [ ] **Step 2: Replace src/app/layout.tsx**

```typescript
import type { Metadata } from 'next'
import { Sarabun } from 'next/font/google'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
import thTH from 'antd/locale/th_TH'
import Link from 'next/link'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'
import { UserNav } from './UserNav'
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

  return (
    <html lang="th">
      <body className={sarabun.className}>
        <SessionProvider>
          <AntdRegistry>
            <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'Sarabun, sans-serif' } }}>
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
                    🔧 ดีดีช่างยนต์
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
                  {(user.role === 'SUPER_ADMIN' || user.role === 'SHOP_ADMIN') && (
                    <Link href="/admin/users" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                      จัดการผู้ใช้
                    </Link>
                  )}
                  <div style={{ marginLeft: 'auto' }}>
                    <UserNav name={user.name!} role={user.role} shopName={user.shopName} />
                  </div>
                </nav>
              )}
              {children}
            </ConfigProvider>
          </AntdRegistry>
        </SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Build ตรวจสอบ TypeScript**

```bash
npm run build 2>&1 | tail -20
```

Expected: build pass

- [ ] **Step 4: Commit**

```bash
git add src/app/UserNav.tsx src/app/layout.tsx
git commit -m "feat: update nav with session user info, role visibility, logout"
```

---

## Task 9: Admin Shops — API + Pages

**Files:**
- Create: `src/app/api/admin/shops/route.ts`
- Create: `src/app/admin/shops/page.tsx`
- Create: `src/app/admin/shops/new/page.tsx`

- [ ] **Step 1: Create src/app/api/admin/shops/route.ts**

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateRefCode } from '@/lib/refCode'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId } = session.user
  if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const where =
    role === 'SUPER_ADMIN'
      ? {}
      : { OR: [{ id: shopId }, { parentId: shopId }] }

  const shops = await prisma.shop.findMany({
    where,
    include: { _count: { select: { users: true } }, parent: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return Response.json(shops)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId } = session.user
  if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, parentId } = body

  if (!name?.trim()) {
    return Response.json({ error: 'ชื่อร้านจำเป็น' }, { status: 422 })
  }

  // SUPER_ADMIN can create main shops and branches
  // SHOP_ADMIN can only create branches of their own shop
  let resolvedParentId: string | null = null
  if (role === 'SHOP_ADMIN') {
    resolvedParentId = shopId // always their own shop
  } else if (parentId) {
    resolvedParentId = parentId
  }

  const refCode = await generateRefCode()
  const shop = await prisma.shop.create({
    data: { name: name.trim(), refCode, parentId: resolvedParentId },
  })

  return Response.json(shop, { status: 201 })
}
```

- [ ] **Step 2: Create src/app/admin/shops/page.tsx**

```typescript
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Table, Tag, Button, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

const { Title } = Typography

export default async function ShopsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, shopId } = session.user
  const where =
    role === 'SUPER_ADMIN'
      ? {}
      : { OR: [{ id: shopId }, { parentId: shopId }] }

  const shops = await prisma.shop.findMany({
    where,
    include: { _count: { select: { users: true } }, parent: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const columns = [
    {
      title: 'ชื่อร้าน',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <span>
          {name}
          {record.parentId && <Tag color="blue" style={{ marginLeft: 8 }}>สาขา</Tag>}
        </span>
      ),
    },
    {
      title: 'Ref Code',
      dataIndex: 'refCode',
      key: 'refCode',
      render: (code: string) => (
        <code style={{ fontFamily: 'monospace', letterSpacing: 3, fontSize: 14 }}>{code}</code>
      ),
    },
    {
      title: 'สังกัด',
      key: 'parent',
      render: (_: any, record: any) => record.parent?.name || <span style={{ color: '#94a3b8' }}>ร้านหลัก</span>,
    },
    { title: 'จำนวน User', key: 'users', render: (_: any, record: any) => record._count.users },
  ]

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>ร้านและสาขา</Title>
        <Link href="/admin/shops/new">
          <Button type="primary" icon={<PlusOutlined />}>
            {role === 'SHOP_ADMIN' ? 'สร้างสาขา' : 'สร้างร้านใหม่'}
          </Button>
        </Link>
      </div>
      <Table dataSource={shops} columns={columns} rowKey="id" pagination={false} />
    </div>
  )
}
```

- [ ] **Step 3: Create src/app/admin/shops/new/page.tsx**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, Typography, Alert } from 'antd'

const { Title } = Typography

export default function NewShopPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFinish({ name }: { name: string }) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/admin/shops')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 480 }}>
      <Title level={4}>สร้างร้านใหม่</Title>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="ชื่อร้าน" name="name" rules={[{ required: true }]}>
            <Input placeholder="ชื่อร้าน" size="large" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => router.back()}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              สร้างร้าน
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/shops/ src/app/admin/shops/
git commit -m "feat: add admin shops API and pages (list + create)"
```

---

## Task 10: Admin Users — API + Pages

**Files:**
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/users/[id]/route.ts`
- Create: `src/app/admin/users/page.tsx`
- Create: `src/app/admin/users/new/page.tsx`
- Create: `src/app/admin/users/[id]/edit/page.tsx`

- [ ] **Step 1: Create src/app/api/admin/users/route.ts**

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import type { Role } from '@prisma/client'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId } = session.user
  if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    where: { shopId },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  return Response.json(users)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role: currentRole, shopId } = session.user
  if (currentRole !== 'SUPER_ADMIN' && currentRole !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, email, password, role } = body

  if (!name?.trim() || !email?.trim() || !password || !role) {
    return Response.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 422 })
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password ต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 422 })
  }
  if (role === 'SUPER_ADMIN' && currentRole !== 'SUPER_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({
    where: { email_shopId: { email: normalizedEmail, shopId } },
  })
  if (existing) {
    return Response.json({ error: 'Email นี้ถูกใช้แล้วในร้านนี้' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: role as Role,
      shopId,
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  })

  return Response.json(user, { status: 201 })
}
```

- [ ] **Step 2: Create src/app/api/admin/users/[id]/route.ts**

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import type { Role } from '@prisma/client'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role: currentRole, shopId } = session.user
  if (currentRole !== 'SUPER_ADMIN' && currentRole !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const target = await prisma.user.findFirst({ where: { id: params.id, shopId } })
  if (!target) return Response.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 })

  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}

  if ('name' in body) data.name = String(body.name).trim()
  if ('role' in body) {
    if (body.role === 'SUPER_ADMIN' && currentRole !== 'SUPER_ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    data.role = body.role as Role
  }
  if ('isActive' in body) data.isActive = Boolean(body.isActive)
  if ('password' in body && body.password) {
    if (String(body.password).length < 8) {
      return Response.json({ error: 'Password ต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 422 })
    }
    data.password = await bcrypt.hash(body.password, 12)
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: 'ไม่มีข้อมูลให้อัพเดท' }, { status: 422 })
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  })

  return Response.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role: currentRole, shopId, id: currentUserId } = session.user
  if (currentRole !== 'SUPER_ADMIN' && currentRole !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (params.id === currentUserId) {
    return Response.json({ error: 'ไม่สามารถลบตัวเองได้' }, { status: 400 })
  }

  const target = await prisma.user.findFirst({ where: { id: params.id, shopId } })
  if (!target) return Response.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 })

  await prisma.user.delete({ where: { id: params.id } })
  return Response.json({ ok: true })
}
```

- [ ] **Step 3: Create src/app/admin/users/page.tsx**

```typescript
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Table, Tag, Button, Switch, Typography, Space } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { Role } from '@prisma/client'

const { Title } = Typography

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  SHOP_ADMIN:  'Shop Admin',
  LEAD_TECH:   'หัวหน้าช่าง',
  TECH:        'ช่าง',
}

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: 'red',
  SHOP_ADMIN:  'orange',
  LEAD_TECH:   'blue',
  TECH:        'default',
}

export default async function UsersPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { shopId } = session.user
  const users = await prisma.user.findMany({
    where: { shopId },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const columns = [
    { title: 'ชื่อ', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: Role) => (
        <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? 'ใช้งาน' : 'ปิดใช้งาน'}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      render: (_: any, record: any) => (
        <Link href={`/admin/users/${record.id}/edit`}>
          <Button size="small" icon={<EditOutlined />}>แก้ไข</Button>
        </Link>
      ),
    },
  ]

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>จัดการผู้ใช้งาน</Title>
        <Space>
          <Link href="/admin/shops">
            <Button>ร้านและสาขา</Button>
          </Link>
          <Link href="/admin/users/new">
            <Button type="primary" icon={<PlusOutlined />}>เพิ่มผู้ใช้</Button>
          </Link>
        </Space>
      </div>
      <Table dataSource={users} columns={columns} rowKey="id" pagination={false} />
    </div>
  )
}
```

- [ ] **Step 4: Create src/app/admin/users/new/page.tsx**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, Select, Button, Card, Typography, Alert } from 'antd'

const { Title } = Typography

const ROLE_OPTIONS = [
  { value: 'SHOP_ADMIN',  label: 'Shop Admin' },
  { value: 'LEAD_TECH',   label: 'หัวหน้าช่าง' },
  { value: 'TECH',        label: 'ช่าง' },
]

export default function NewUserPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFinish(values: {
    name: string; email: string; password: string; role: string
  }) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/admin/users')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 480 }}>
      <Title level={4}>เพิ่มผู้ใช้ใหม่</Title>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="ชื่อ" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Password" name="password" rules={[{ required: true, min: 8, message: 'อย่างน้อย 8 ตัวอักษร' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="Role" name="role" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => router.back()}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={loading}>เพิ่มผู้ใช้</Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Create src/app/admin/users/[id]/edit/page.tsx**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Form, Input, Select, Button, Card, Typography, Alert, Switch } from 'antd'

const { Title } = Typography

const ROLE_OPTIONS = [
  { value: 'SHOP_ADMIN', label: 'Shop Admin' },
  { value: 'LEAD_TECH',  label: 'หัวหน้าช่าง' },
  { value: 'TECH',       label: 'ช่าง' },
]

export default function EditUserPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/users`)
      .then((r) => r.json())
      .then((users: any[]) => {
        const user = users.find((u) => u.id === params.id)
        if (user) form.setFieldsValue({ name: user.name, role: user.role, isActive: user.isActive })
      })
      .finally(() => setFetching(false))
  }, [params.id, form])

  async function onFinish(values: { name: string; role: string; isActive: boolean; newPassword?: string }) {
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, any> = { name: values.name, role: values.role, isActive: values.isActive }
      if (values.newPassword) body.password = values.newPassword

      const res = await fetch(`/api/admin/users/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/admin/users')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) return <div style={{ padding: '2rem' }}>กำลังโหลด...</div>

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 480 }}>
      <Title level={4}>แก้ไขผู้ใช้</Title>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="ชื่อ" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Role" name="role" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item label="สถานะ" name="isActive" valuePropName="checked">
            <Switch checkedChildren="ใช้งาน" unCheckedChildren="ปิด" />
          </Form.Item>
          <Form.Item label="Password ใหม่ (เว้นว่างถ้าไม่เปลี่ยน)" name="newPassword"
            rules={[{ min: 8, message: 'อย่างน้อย 8 ตัวอักษร' }]}>
            <Input.Password placeholder="เว้นว่างถ้าไม่เปลี่ยน" />
          </Form.Item>
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

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/users/ "src/app/admin/users/"
git commit -m "feat: add admin users API and pages (list, create, edit)"
```

---

## Task 11: Scope Existing Job API Routes

**Files:**
- Modify: `src/app/api/jobs/route.ts`
- Modify: `src/app/api/jobs/[id]/route.ts`
- Modify: `src/app/api/jobs/[id]/images/route.ts`
- Modify: `src/app/api/jobs/export/route.ts`

- [ ] **Step 1: Update src/app/api/jobs/route.ts**

เพิ่ม auth + shopId scope ใน GET และ POST:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateJobNo } from '@/lib/jobNo'
import { auth } from '@/auth'

/* ─── POST /api/jobs ─────────────────────────────────────────────────────── */
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
        shopId,
        createdBy: userId,
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
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { shopId } = session.user

    const { searchParams } = new URL(request.url)
    const pageRaw     = Number(searchParams.get('page')     || '1')
    const pageSizeRaw = Number(searchParams.get('pageSize') || '20')
    const page     = isNaN(pageRaw)     ? 1  : Math.max(1, pageRaw)
    const pageSize = isNaN(pageSizeRaw) ? 20 : Math.min(100, Math.max(1, pageSizeRaw))
    const search   = searchParams.get('search')   || ''
    const status   = searchParams.get('status')   || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo   = searchParams.get('dateTo')   || ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { shopId }

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
  } catch (err) {
    console.error('[GET /api/jobs]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Update src/app/api/jobs/[id]/route.ts — เพิ่ม auth + shopId guard**

เพิ่ม auth check ต้นทั้ง GET และ PATCH:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.job.findFirst({
      where: { id: params.id, shopId: session.user.shopId },
      include: { images: { select: { id: true, filename: true } } },
    })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(job)
  } catch (err) {
    console.error('[GET /api/jobs/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
    })
    if (!existing) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    // TECH can only edit their own jobs
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

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 422 })
    }

    const updated = await prisma.job.update({ where: { id: params.id }, data })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/jobs/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Update src/app/api/jobs/[id]/images/route.ts — เพิ่ม auth check**

เพิ่มต้น POST handler:
```typescript
import { auth } from '@/auth'

// ใน POST handler ต้น function:
const session = await auth()
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

- [ ] **Step 4: Update src/app/api/jobs/export/route.ts — เพิ่ม shopId scope**

เพิ่มต้น GET handler และเพิ่ม `shopId` ใน where:
```typescript
import { auth } from '@/auth'

// ต้น GET handler:
const session = await auth()
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const { shopId } = session.user

// ใน where object:
const where: any = { shopId }
// ... ต่อ filters เดิม
```

- [ ] **Step 5: Build ตรวจสอบ**

```bash
npm run build 2>&1 | tail -20
```

Expected: build pass ไม่มี TypeScript error

- [ ] **Step 6: Commit**

```bash
git add src/app/api/jobs/
git commit -m "feat: scope all job API routes by shopId + auth guard"
```

---

## Task 12: Scope Analytics API + Docker ENV

**Files:**
- Modify: `src/app/api/analytics/route.ts`
- Modify: `docker-compose.yml`

- [ ] **Step 1: เพิ่ม auth + shopId scope ใน src/app/api/analytics/route.ts**

เพิ่มต้น GET handler (บรรทัดแรกของ try block):

```typescript
import { auth } from '@/auth'

// ต้น GET handler ใน try:
const session = await auth()
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const { shopId } = session.user

// เพิ่มใน where object:
const where: any = { shopId }
// ... ต่อ date filters เดิม (if dateFrom || dateTo ...)
```

- [ ] **Step 2: Update docker-compose.yml — เพิ่ม AUTH_SECRET**

เพิ่ม environment ใน service `app`:

```yaml
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://ddreport:ddreport_pass@postgres:5432/ddreport
      NODE_ENV: production
      UPLOADS_DIR: /uploads
      AUTH_SECRET: ${AUTH_SECRET}
    volumes:
      - uploads_data:/uploads
    depends_on:
      postgres:
        condition: service_healthy
```

- [ ] **Step 3: สร้าง .env.production ถ้ายังไม่มี**

```bash
# .env.production (อย่า commit — อยู่ใน .gitignore แล้ว)
DATABASE_URL=postgresql://ddreport:ddreport_pass@postgres:5432/ddreport
AUTH_SECRET=<run: openssl rand -base64 32>
```

- [ ] **Step 4: Build Docker image และรัน**

```bash
docker compose build --no-cache
docker compose up -d
```

Expected: containers start without error

- [ ] **Step 5: ทดสอบ full flow**

```
1. เปิด http://localhost → redirect ไป /login
2. Login → เห็นชื่อ user บน nav + logout button
3. สร้างงานซ่อม → job มี shopId ถูกต้อง (ตรวจใน DB)
4. ไปหน้า /report → เห็นแต่งานของร้านตัวเอง
5. ไปหน้า /admin/users → เพิ่ม user ใหม่
6. Login ด้วย user ใหม่ → เห็น nav ตาม role
7. ไปหน้า /analytics ด้วย TECH user → redirect กลับ /
```

- [ ] **Step 6: Commit และ push**

```bash
git add src/app/api/analytics/ docker-compose.yml
git commit -m "feat: scope analytics API by shopId, add AUTH_SECRET to docker-compose"
git push origin feature/auth
```

---

## หมายเหตุ: Migration ข้อมูลเดิม

Job เดิมที่มี `shopId = null` จะถูก assign ให้ร้านแรกโดยอัตโนมัติผ่าน Setup API (ดู Task 5 step `updateMany`) เมื่อรัน `/setup` ครั้งแรก ข้อมูลทั้งหมดจะถูก migrate ให้ Shop ที่สร้าง
