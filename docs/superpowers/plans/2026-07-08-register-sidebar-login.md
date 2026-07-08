# Register Page + Login Redesign + Sidebar Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shop owner self-registration, redesign login as single-step with optional refCode, and replace the top nav with a collapsible sidebar layout.

**Architecture:** Server Component `layout.tsx` fetches auth + badge count and passes them as props to a new `AppShell` Client Component that owns sidebar collapse state. Auth logic in `auth.ts` branches on whether refCode is provided. Registration creates a Shop + SHOP_ADMIN User atomically via a public API route.

**Tech Stack:** Next.js 14 App Router, NextAuth v5, Prisma + PostgreSQL, Ant Design, Lucide React, bcryptjs, Jest (node env)

## Global Constraints

- All new UI must use Ant Design components + Lucide icons (no emoji)
- Sidebar background `#1e293b`, topbar white with `box-shadow: 0 1px 4px rgba(0,0,0,0.1)`
- `refCode` is always 5-char uppercase alphanumeric, auto-generated on registration
- `SUPER_ADMIN` / `SHOP_ADMIN` login without refCode; `LEAD_TECH` / `TECH` require refCode
- Jest tests go in `__tests__/**/*.test.ts` (node environment, `@/` alias available)

---

## File Map

| Status | Path | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add `phone String?` and `birthDate DateTime?` to `User` |
| Create | `src/app/AppShell.tsx` | Client component: sidebar + topbar + collapse state |
| Modify | `src/app/layout.tsx` | Remove `<nav>`, render `<AppShell>` with user + badge props |
| Modify | `src/app/UserNav.tsx` | Remove hardcoded white color (topbar is now white) |
| Modify | `src/app/login/LoginForm.tsx` | Single-step form with optional refCode field |
| Modify | `src/auth.ts` | Branch authorize logic on refCode presence |
| Create | `src/app/api/auth/register/route.ts` | POST: validate, generate refCode, create Shop + User |
| Create | `src/app/register/RegisterForm.tsx` | Client registration form (10 fields + checkboxes) |
| Create | `src/app/register/page.tsx` | Server wrapper: redirect if already logged in |
| Create | `__tests__/api/auth/register.test.ts` | Unit test for refCode generation + register logic |

---

## Task 1: Schema Migration — Add Phone + BirthDate to User

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `User.phone: String?`, `User.birthDate: DateTime?` available in all Prisma queries

- [ ] **Step 1: Add fields to User model**

Open `prisma/schema.prisma` and add two lines inside the `User` model, after `createdAt`:

```prisma
model User {
  id           String   @id @default(cuid())
  email        String
  password     String
  name         String
  role         Role
  isActive     Boolean  @default(true)
  shopId       String
  phone        String?
  birthDate    DateTime?
  shop         Shop     @relation(fields: [shopId], references: [id])
  createdJobs  Job[]    @relation("CreatedBy")
  assignedJobs Job[]    @relation("AssignedJobs")
  createdAt    DateTime @default(now())

  @@unique([email, shopId])
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-user-phone-birthdate
```

Expected output: `✔  Generated Prisma Client`

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add phone and birthDate fields to User model"
```

---

## Task 2: Sidebar Layout — AppShell Component

**Files:**
- Create: `src/app/AppShell.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/UserNav.tsx`

**Interfaces:**
- Consumes: `user: { name: string; role: Role; shopId: string; shopName: string }`, `pendingTransferCount: number`, `children: React.ReactNode`
- Produces: `<AppShell>` component rendered in layout.tsx replacing the `<nav>` block

- [ ] **Step 1: Update UserNav to use default (dark) button color**

In `src/app/UserNav.tsx`, remove the `style={{ color: 'rgba(255,255,255,0.85)' }}` from the Button so it uses Ant Design's default dark text on the white topbar:

```tsx
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
      <Button type="text" icon={<UserOutlined />}>
        {name}
      </Button>
    </Dropdown>
  )
}
```

- [ ] **Step 2: Create AppShell.tsx**

Create `src/app/AppShell.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Layout, Menu, Badge, Tooltip } from 'antd'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CarOutlined, FileTextOutlined, BarChartOutlined,
  AppstoreOutlined, SwapOutlined, TeamOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons'
import { Wrench } from 'lucide-react'
import { UserNav } from './UserNav'
import type { Role } from '@prisma/client'

interface Props {
  user: { name: string; role: Role; shopId: string; shopName: string }
  pendingTransferCount: number
  children: React.ReactNode
}

const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'SHOP_ADMIN', 'LEAD_TECH']
const SUPER_ROLES: Role[] = ['SUPER_ADMIN', 'SHOP_ADMIN']

export default function AppShell({ user, pendingTransferCount, children }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  // Collapse by default on mobile
  useEffect(() => {
    if (window.innerWidth < 768) setCollapsed(true)
  }, [])

  const navItems = [
    {
      key: '/',
      icon: <CarOutlined />,
      label: <Link href="/">รับรถเข้าซ่อม</Link>,
    },
    {
      key: '/report',
      icon: <FileTextOutlined />,
      label: <Link href="/report">รายงาน</Link>,
    },
    ...(ADMIN_ROLES.includes(user.role) ? [
      {
        key: '/analytics',
        icon: <BarChartOutlined />,
        label: <Link href="/analytics">วิเคราะห์ข้อมูล</Link>,
      },
      {
        key: '/stock',
        icon: <AppstoreOutlined />,
        label: <Link href="/stock">คลังอะไหล่</Link>,
      },
      {
        key: '/jobs/incoming',
        icon: <SwapOutlined />,
        label: (
          <Link href="/jobs/incoming">
            งานที่รับโอน{' '}
            {pendingTransferCount > 0 && (
              <Badge count={pendingTransferCount} size="small" style={{ marginLeft: 4 }} />
            )}
          </Link>
        ),
      },
    ] : []),
    ...(SUPER_ROLES.includes(user.role) ? [
      {
        key: '/admin/users',
        icon: <TeamOutlined />,
        label: <Link href="/admin/users">จัดการผู้ใช้</Link>,
      },
    ] : []),
  ]

  // Match active key: exact for '/', prefix for others
  const selectedKey = navItems.find(item =>
    item.key === '/' ? pathname === '/' : pathname.startsWith(item.key)
  )?.key ?? pathname

  const siderWidth = 220
  const collapsedWidth = 64

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <Layout.Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={siderWidth}
        collapsedWidth={collapsedWidth}
        style={{
          background: '#1e293b',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 20px',
          color: 'white',
          fontWeight: 700,
          fontSize: '1rem',
          gap: 8,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <Wrench size={18} />
          {!collapsed && <span>ดีดีช่างยนต์</span>}
        </div>

        {/* Nav menu */}
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[selectedKey]}
          style={{ background: 'transparent', border: 'none', flex: 1, marginTop: 8 }}
          items={navItems}
        />

        {/* Footer links */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: collapsed ? '12px 0' : '12px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {collapsed ? (
            <>
              <Tooltip title="Privacy Policy" placement="right">
                <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', display: 'block' }}>P</Link>
              </Tooltip>
              <Tooltip title="Terms of Service" placement="right">
                <Link href="/terms" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', display: 'block' }}>T</Link>
              </Tooltip>
            </>
          ) : (
            <>
              <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Privacy Policy</Link>
              <Link href="/terms" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Terms of Service</Link>
            </>
          )}
        </div>
      </Layout.Sider>

      {/* Main area */}
      <Layout style={{
        marginLeft: collapsed ? collapsedWidth : siderWidth,
        transition: 'margin-left 0.2s',
      }}>
        {/* Topbar */}
        <Layout.Header style={{
          background: 'white',
          padding: '0 16px',
          height: 56,
          lineHeight: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', color: '#374151' }}
          >
            {collapsed ? <MenuUnfoldOutlined style={{ fontSize: 18 }} /> : <MenuFoldOutlined style={{ fontSize: 18 }} />}
          </button>
          <UserNav name={user.name} role={user.role} shopName={user.shopName} />
        </Layout.Header>

        {/* Page content */}
        <Layout.Content>
          {children}
        </Layout.Content>

        {/* Footer */}
        <footer style={{ textAlign: 'center', padding: '1.5rem', fontSize: 12, color: '#94a3b8' }}>
          <Link href="/privacy" style={{ color: '#94a3b8', marginRight: 16 }}>Privacy Policy</Link>
          <Link href="/terms" style={{ color: '#94a3b8' }}>Terms of Service</Link>
        </footer>
      </Layout>
    </Layout>
  )
}
```

- [ ] **Step 3: Update layout.tsx to use AppShell**

Replace the entire `layout.tsx` body with the AppShell-based version. The Server Component still fetches auth + badge count, but renders `<AppShell>` instead of the inline `<nav>`:

```tsx
import type { Metadata } from 'next'
import { Sarabun } from 'next/font/google'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
import thTH from 'antd/locale/th_TH'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import AppShell from './AppShell'
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
    <html lang="th">
      <body className={sarabun.className}>
        <SessionProvider>
          <AntdRegistry>
            <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'Sarabun, sans-serif' } }}>
              {user ? (
                <AppShell
                  user={{ name: user.name!, role: user.role, shopId: user.shopId, shopName: user.shopName }}
                  pendingTransferCount={pendingTransferCount}
                >
                  {children}
                </AppShell>
              ) : (
                <>
                  {children}
                  <footer style={{ textAlign: 'center', padding: '1.5rem', fontSize: 12, color: '#94a3b8' }}>
                    <a href="/privacy" style={{ color: '#94a3b8', marginRight: 16 }}>Privacy Policy</a>
                    <a href="/terms" style={{ color: '#94a3b8' }}>Terms of Service</a>
                  </footer>
                </>
              )}
            </ConfigProvider>
          </AntdRegistry>
        </SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual verification**

Start dev server (`npm run dev`), log in, and verify:
- Sidebar shows on the left with nav links
- Toggle button (☰) in topbar collapses/expands sidebar
- Content shifts right correctly on expand/collapse
- Active nav link is highlighted
- UserNav (name + dropdown) shows in top-right
- Unauthenticated pages (login, register) show no sidebar

- [ ] **Step 6: Commit**

```bash
git add src/app/AppShell.tsx src/app/layout.tsx src/app/UserNav.tsx
git commit -m "feat: replace top nav with collapsible sidebar layout"
```

---

## Task 3: Login Page Redesign — Single-Step Form + Auth Logic

**Files:**
- Modify: `src/app/login/LoginForm.tsx`
- Modify: `src/auth.ts`

**Interfaces:**
- Consumes: `signIn('credentials', { email, password, refCode? })` from next-auth
- Produces: single-step login form; updated `authorize()` that branches on refCode

- [ ] **Step 1: Update auth.ts to support optional refCode**

Replace the `authorize` function in `src/auth.ts`:

```ts
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
          refCode?: string
          email: string
          password: string
        }
        if (!email || !password) return null

        const normalizedEmail = email.trim().toLowerCase()

        if (!refCode || refCode.trim() === '') {
          // Admin path: find by email only, must be SUPER_ADMIN or SHOP_ADMIN
          const user = await prisma.user.findFirst({
            where: {
              email: normalizedEmail,
              role: { in: ['SUPER_ADMIN', 'SHOP_ADMIN'] },
              isActive: true,
            },
            include: { shop: true },
          })
          if (!user) return null
          const valid = await bcrypt.compare(password, user.password)
          if (!valid) return null
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            shopId: user.shopId,
            shopName: user.shop.name,
          }
        } else {
          // Staff path: find by refCode + email, must be LEAD_TECH or TECH
          const shop = await prisma.shop.findUnique({
            where: { refCode: refCode.trim().toUpperCase() },
          })
          if (!shop) return null
          const user = await prisma.user.findUnique({
            where: { email_shopId: { email: normalizedEmail, shopId: shop.id } },
          })
          if (!user || !user.isActive) return null
          if (!(['LEAD_TECH', 'TECH'] as Role[]).includes(user.role)) return null
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
      session.user.id       = token.id as string
      session.user.role     = token.role as Role
      session.user.shopId   = token.shopId as string
      session.user.shopName = token.shopName as string
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
})
```

- [ ] **Step 2: Rewrite LoginForm.tsx as single-step**

Replace the entire `src/app/login/LoginForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, Typography, Alert, Divider } from 'antd'
import Link from 'next/link'
import { Wrench } from 'lucide-react'

const { Title, Text } = Typography

export default function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form] = Form.useForm()

  async function onLogin({ email, password, refCode }: { email: string; password: string; refCode?: string }) {
    setLoading(true)
    setError(null)
    const result = await signIn('credentials', {
      email,
      password,
      refCode: refCode ?? '',
      redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError('Email, Password หรือรหัสร้านไม่ถูกต้อง')
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <Card style={{ width: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <Wrench size={32} color="#2563eb" />
        </div>
        <Title level={3} style={{ margin: 0 }}>DDReport</Title>
      </div>

      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
      )}

      <Form form={form} layout="vertical" onFinish={onLogin}>
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
        <Form.Item
          label={<span>รหัสร้าน <Text type="secondary" style={{ fontSize: 12 }}>(สำหรับช่างหรือพนักงาน)</Text></span>}
          name="refCode"
        >
          <Input
            placeholder="เช่น A3K9M"
            maxLength={5}
            size="large"
            style={{ textTransform: 'uppercase', letterSpacing: 4, fontFamily: 'monospace' }}
            onChange={e => form.setFieldValue('refCode', e.target.value.toUpperCase())}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block size="large">
          เข้าสู่ระบบ
        </Button>
      </Form>

      <Divider style={{ margin: '20px 0' }} />
      <div style={{ textAlign: 'center' }}>
        <Text type="secondary">ยังไม่มีบัญชี? </Text>
        <Link href="/register">สมัครสมาชิก</Link>
      </div>
    </Card>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual verification**

Test both login paths:
1. Login as SHOP_ADMIN with email + password only (no refCode) → should succeed
2. Login as TECH with email + password + refCode → should succeed
3. Login as SHOP_ADMIN with a refCode → should fail (wrong role for that path)
4. Wrong password → should show error message

- [ ] **Step 5: Commit**

```bash
git add src/auth.ts src/app/login/LoginForm.tsx
git commit -m "feat: redesign login as single-step with optional refCode"
```

---

## Task 4: Register API Route

**Files:**
- Create: `src/app/api/auth/register/route.ts`
- Create: `__tests__/api/auth/register.test.ts`

**Interfaces:**
- Produces: `POST /api/auth/register` accepts `{ firstName, lastName, shopName, email, password, phone, birthDate }` → returns `{ success: true }` or `{ error: string }` with appropriate HTTP status

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/auth/register.test.ts`:

```ts
import { generateRefCode } from '@/app/api/auth/register/route'

describe('generateRefCode', () => {
  it('returns a 5-char uppercase alphanumeric string', () => {
    const code = generateRefCode()
    expect(code).toHaveLength(5)
    expect(code).toMatch(/^[A-Z0-9]+$/)
  })

  it('produces different codes on repeated calls', () => {
    const codes = new Set(Array.from({ length: 20 }, generateRefCode))
    expect(codes.size).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/auth/register.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/auth/register/route'`

- [ ] **Step 3: Create the register API route**

Create `src/app/api/auth/register/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRefCode(): string {
  return Array.from({ length: 5 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
}

async function uniqueRefCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateRefCode()
    const exists = await prisma.shop.findUnique({ where: { refCode: code } })
    if (!exists) return code
  }
  throw new Error('Could not generate unique refCode')
}

export async function POST(req: Request) {
  try {
    const { firstName, lastName, shopName, email, password, phone, birthDate } = await req.json()

    if (!firstName || !lastName || !shopName || !email || !password || !phone || !birthDate) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
    }

    const normalizedEmail = (email as string).trim().toLowerCase()

    const existing = await prisma.user.findFirst({ where: { email: normalizedEmail, role: { in: ['SUPER_ADMIN', 'SHOP_ADMIN'] } } })
    if (existing) {
      return NextResponse.json({ error: 'Email นี้ถูกใช้งานแล้ว' }, { status: 409 })
    }

    const refCode = await uniqueRefCode()
    const hashedPassword = await bcrypt.hash(password as string, 10)

    await prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: { refCode, name: shopName as string },
      })
      await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          name: `${firstName} ${lastName}`.trim(),
          role: 'SHOP_ADMIN',
          shopId: shop.id,
          phone: phone as string,
          birthDate: new Date(birthDate as string),
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[register]', err)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/auth/register.test.ts --no-coverage
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/register/route.ts __tests__/api/auth/register.test.ts
git commit -m "feat: add POST /api/auth/register endpoint with refCode generation"
```

---

## Task 5: Register Page UI

**Files:**
- Create: `src/app/register/RegisterForm.tsx`
- Create: `src/app/register/page.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/register` (Task 4), `signIn('credentials', ...)` from next-auth
- Produces: `/register` page accessible from login page link

- [ ] **Step 1: Create RegisterForm.tsx**

Create `src/app/register/RegisterForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, Typography, Alert, Checkbox, DatePicker, Divider } from 'antd'
import Link from 'next/link'
import { Wrench } from 'lucide-react'
import type { Dayjs } from 'dayjs'

const { Title, Text } = Typography

interface FormValues {
  firstName: string
  lastName: string
  shopName: string
  email: string
  password: string
  confirmPassword: string
  phone: string
  birthDate: Dayjs
  acceptPrivacy: boolean
  acceptTerms: boolean
}

export default function RegisterForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form] = Form.useForm<FormValues>()

  async function onFinish(values: FormValues) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          shopName: values.shopName,
          email: values.email,
          password: values.password,
          phone: values.phone,
          birthDate: values.birthDate.format('YYYY-MM-DD'),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }

      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        refCode: '',
        redirect: false,
      })
      if (result?.error) {
        setError('สมัครสมาชิกสำเร็จ แต่เข้าสู่ระบบไม่ได้ กรุณา Login ใหม่')
        router.push('/login')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ width: 480, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <Wrench size={28} color="#2563eb" />
        </div>
        <Title level={3} style={{ margin: 0 }}>สมัครสมาชิก</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>สร้างร้านและบัญชีผู้ดูแลระบบ</Text>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item label="ชื่อ" name="firstName" rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item label="นามสกุล" name="lastName" rules={[{ required: true, message: 'กรุณากรอกนามสกุล' }]}>
            <Input size="large" />
          </Form.Item>
        </div>

        <Form.Item label="ชื่อร้าน" name="shopName" rules={[{ required: true, message: 'กรุณากรอกชื่อร้าน' }]}>
          <Input size="large" placeholder="เช่น ดีดีช่างยนต์" />
        </Form.Item>

        <Form.Item label="อีเมล" name="email" rules={[{ required: true, type: 'email', message: 'กรุณากรอก Email ที่ถูกต้อง' }]}>
          <Input size="large" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item label="รหัสผ่าน" name="password" rules={[{ required: true, min: 8, message: 'อย่างน้อย 8 ตัวอักษร' }]}>
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item
            label="ยืนยันรหัสผ่าน"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: 'กรุณายืนยัน Password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve()
                  return Promise.reject(new Error('รหัสผ่านไม่ตรงกัน'))
                },
              }),
            ]}
          >
            <Input.Password size="large" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item label="เบอร์โทร" name="phone" rules={[{ required: true, message: 'กรุณากรอกเบอร์โทร' }]}>
            <Input size="large" maxLength={10} />
          </Form.Item>
          <Form.Item label="วันเกิด" name="birthDate" rules={[{ required: true, message: 'กรุณาเลือกวันเกิด' }]}>
            <DatePicker size="large" style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>

        <Form.Item
          name="acceptPrivacy"
          valuePropName="checked"
          rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject('กรุณายอมรับ Privacy Policy') }]}
        >
          <Checkbox>
            ยอมรับ <Link href="/privacy" target="_blank">Privacy Policy</Link>
          </Checkbox>
        </Form.Item>

        <Form.Item
          name="acceptTerms"
          valuePropName="checked"
          rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject('กรุณายอมรับ Terms of Service') }]}
          style={{ marginBottom: 20 }}
        >
          <Checkbox>
            ยอมรับ <Link href="/terms" target="_blank">Terms of Service</Link>
          </Checkbox>
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={loading} block size="large">
          สมัครสมาชิก
        </Button>
      </Form>

      <Divider style={{ margin: '20px 0' }} />
      <div style={{ textAlign: 'center' }}>
        <Text type="secondary">มีบัญชีแล้ว? </Text>
        <Link href="/login">เข้าสู่ระบบ</Link>
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Create register/page.tsx**

Create `src/app/register/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import RegisterForm from './RegisterForm'

export default async function RegisterPage() {
  const session = await auth()
  if (session) redirect('/')

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#f1f5f9',
      padding: '24px 16px',
    }}>
      <RegisterForm />
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual verification**

1. Go to `/login` → click "สมัครสมาชิก" → lands on `/register`
2. Fill all fields and submit → redirects to `/`
3. Verify in Prisma Studio (`npx prisma studio`) that a new Shop + User (SHOP_ADMIN) was created with phone and birthDate
4. Log out, go to `/login`, use the new email + password (no refCode) → should log in successfully
5. Try submitting register form without checking the checkboxes → should show validation error

- [ ] **Step 5: Commit**

```bash
git add src/app/register/
git commit -m "feat: add /register page for new shop owner self-registration"
```
