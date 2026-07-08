# Design Spec: Register Page + Login Redesign + Sidebar Layout

Date: 2026-07-08

---

## Overview

Three interconnected changes to the app shell and auth flow:

1. **Login page** — collapse 2-step flow into a single form with optional refCode
2. **Register page** (`/register`) — new shop owner self-registration
3. **Sidebar layout** — replace top nav with collapsible sidebar + slim topbar

---

## 1. Login Page Redesign

### Current flow (2-step)
Step 0: enter refCode → Step 1: enter email + password

### New flow (single step)
All fields on one screen simultaneously.

**Fields:**
| Field | Required |
|---|---|
| Email | ✅ |
| Password | ✅ |
| รหัสร้าน | ❌ optional |

**Auth logic (in `src/auth.ts`):**
- **No refCode provided** → find user by email across all shops; must be `SUPER_ADMIN` or `SHOP_ADMIN`. Looks up `User` where `email = input.email`, then verifies password and role.
- **refCode provided** → find shop by refCode, then find user by `email + shopId`; role must be `LEAD_TECH` or `TECH`.

**UI additions:**
- Below the login button: "ยังไม่มีบัญชี? [สมัครสมาชิก]" link → navigates to `/register`

---

## 2. Register Page (`/register`)

New page for shop owners to self-register — instantly creates a Shop + SHOP_ADMIN user.

### Fields
| Field | Type | Required |
|---|---|---|
| ชื่อ (firstName) | text | ✅ |
| นามสกุล (lastName) | text | ✅ |
| ชื่อร้าน | text | ✅ |
| อีเมล | email | ✅ |
| รหัสผ่าน | password | ✅ min 8 chars |
| ยืนยันรหัสผ่าน | password | ✅ must match |
| เบอร์โทร | tel | ✅ |
| วันเกิด | date | ✅ |
| ยอมรับ Privacy Policy | checkbox | ✅ |
| ยอมรับ Terms of Service | checkbox | ✅ |

### Submit flow
1. Validate all fields client-side
2. POST `/api/auth/register`
3. API: generate unique 5-char uppercase alphanumeric `refCode` (retry if collision)
4. Create `Shop` with name + refCode
5. Create `User` with role `SHOP_ADMIN`, `name = "${firstName} ${lastName}"`, hashed password, phone, birthDate
6. Return success
7. Client calls `signIn('credentials', { email, password, redirect: false })`
8. Redirect to `/`

### Schema changes (Prisma migration)
Add to `User` model:
```prisma
phone     String?
birthDate DateTime?
```

### API route
`POST /api/auth/register` — public endpoint (no auth required)

---

## 3. Sidebar Layout

### Structure
Replace the current `<nav>` in `layout.tsx` with a two-panel layout: fixed sidebar on the left + content area on the right with a slim topbar.

```
┌─────────────────────────────────────────────────────┐
│ TopBar  [☰ toggle]                      [UserNav]   │
├───────────┬─────────────────────────────────────────┤
│           │                                         │
│  Sidebar  │   Main Content + Footer                 │
│  220px    │                                         │
│           │                                         │
│  🔧 DDR   │                                         │
│  ─────    │                                         │
│  nav items│                                         │
│           │                                         │
│  Privacy  │                                         │
│  Terms    │                                         │
└───────────┴─────────────────────────────────────────┘
```

**Collapsed (64px):**
- Only icons visible, no labels
- Tooltip on hover shows label

### Component architecture

**`layout.tsx`** (Server Component — unchanged pattern)
- Still fetches `auth()` + `pendingTransferCount`
- Renders `<AppShell>` and passes `user`, `pendingTransferCount` as props

**`AppShell.tsx`** (new Client Component)
- Holds `collapsed` boolean state (default: false)
- Uses Ant Design `Layout`, `Layout.Sider`, `Layout.Header`, `Layout.Content`
- Renders topbar + sidebar + children

**`AppSidebar.tsx`** (new component, inside AppShell or separate)
- Ant Design `Menu` component with `items` array
- Menu items include icons (Ant Design icons)
- Role-based filtering passed as props from server
- Badge on "งานที่รับโอน" if `pendingTransferCount > 0`

### Nav items + icons

| Label | Path | Icon | Role guard |
|---|---|---|---|
| รับรถเข้าซ่อม | `/` | `CarOutlined` | all |
| รายงาน | `/report` | `FileTextOutlined` | all |
| วิเคราะห์ข้อมูล | `/analytics` | `BarChartOutlined` | SUPER_ADMIN, SHOP_ADMIN, LEAD_TECH |
| คลังอะไหล่ | `/stock` | `AppstoreOutlined` | SUPER_ADMIN, SHOP_ADMIN, LEAD_TECH |
| งานที่รับโอน | `/jobs/incoming` | `SwapOutlined` | SUPER_ADMIN, SHOP_ADMIN, LEAD_TECH |
| จัดการผู้ใช้ | `/admin/users` | `TeamOutlined` | SUPER_ADMIN, SHOP_ADMIN |

### Styling
- Sidebar background: `#1e293b` (dark slate)
- Sidebar text/icons: `rgba(255,255,255,0.85)`
- Active item: blue highlight (`#2563eb`)
- TopBar: white background, `box-shadow: 0 1px 4px rgba(0,0,0,0.1)`, height 56px
- Sidebar expanded width: 220px, collapsed: 64px
- Footer links (Privacy, Terms) pinned to bottom of sidebar

### Mobile
- Sidebar collapses by default on narrow viewports (< 768px)
- Toggle button in topbar controls open/close
