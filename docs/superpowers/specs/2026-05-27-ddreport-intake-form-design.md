# ดีดีช่างยนต์ — Intake Form Design Spec
**Date:** 2026-05-27  
**Stack:** Next.js 14 (App Router) · Ant Design 5 · Prisma · PostgreSQL · Docker · Nginx  
**Domain:** `ddreport.local` (local network only, no auth)

---

## 1. Goals

Build a Thai-language car-repair intake form for shop staff to log vehicle jobs. After submission the system auto-assigns a job number and renders a print-friendly receipt. All data is stored in PostgreSQL. The app is self-hosted via Docker Compose on a local machine and accessed at `http://ddreport.local`.

---

## 2. Architecture

```
Browser
  └─► Nginx :80 (ddreport.local)
        └─► Next.js app :3000
              └─► PostgreSQL :5432
```

- **Next.js** runs in standalone output mode (`output: 'standalone'`) inside a multi-stage Docker image.
- **PostgreSQL 16** uses a named Docker volume for persistence.
- **Nginx** acts as a reverse proxy — listens on port 80, forwards all traffic to the Next.js container.
- **Local domain**: the user adds `127.0.0.1 ddreport.local` to their `/etc/hosts` once.
- **Prisma migrations** execute automatically on container start via an entrypoint shell script.

---

## 3. Pages

| Route | Purpose |
|---|---|
| `/` | 4-step Ant Design wizard — intake form |
| `/receipt/[id]` | Print-friendly job summary page |

---

## 4. Intake Form — 4-Step Wizard

Uses Ant Design `Steps` + `Form` with client-side state held in `useState` (all steps share one form instance via `Form.useForm()`).

### Step 1 — ข้อมูลเบื้องต้น (Basic Info)
| Field | Type | Notes |
|---|---|---|
| วันที่รับรถ | Date picker | Required |
| เวลา | Time picker | Required |

> **Job No.** (`DD-YYYYMMDD-NNN`) is auto-generated server-side on submit and displayed only on the receipt page — it is not a form field.

### Step 2 — ข้อมูลลูกค้าและรถ (Customer & Vehicle)
| Field | Type | Notes |
|---|---|---|
| ชื่อ-นามสกุล | Text input | Required |
| เบอร์โทรศัพท์ | Text input | Required |
| ทะเบียนรถ | Text input | Required |
| เลขไมล์ (KM) | Number input | Required |

### Step 3 — อาการที่แจ้ง (Reported Symptoms)
| Field | Type | Notes |
|---|---|---|
| Symptom checkboxes | Checkbox.Group | ระบบเครื่องยนต์, ระบบส่งกำลัง, ระบบช่วงล่าง, ระบบปรับอากาศ, ระบบเบรค |
| รายละเอียดเพิ่มเติม | Textarea | Optional |
| Staff script box | Read-only styled box | "เดี๋ยวช่างนัทจะเช็คอย่างละเอียดและโทรแจ้งราคาก่อนซ่อมนะคะ" |

### Step 4 — บันทึกผลและราคา (Result & Price)
| Field | Type | Notes |
|---|---|---|
| สาเหตุที่พบ/อะไหล่ | Textarea | Required |
| สรุปราคาสุทธิ (บาท) | Number input | Required |
| สถานะ | Select | ลูกค้าอนุมัติซ่อมแล้ว / ซ่อมเสร็จเรียบร้อยแล้ว / ส่งมอบและเก็บเงินแล้ว |

**Navigation:** Back/Next buttons between steps. The Next button validates only the current step's fields before advancing. Submit button on Step 4 calls `POST /api/jobs`.

---

## 5. API Route

### `POST /api/jobs`
**Request body:**
```json
{
  "date": "2026-05-27",
  "time": "09:30",
  "customerName": "สมชาย มีดี",
  "phone": "081-234-5678",
  "licensePlate": "กข 1234",
  "odometer": 85000,
  "symptoms": ["ระบบเครื่องยนต์", "ระบบเบรค"],
  "notes": "เสียงดังตอนเบรค",
  "cause": "ผ้าเบรคหมด",
  "totalPrice": 1500,
  "status": "ลูกค้าอนุมัติซ่อมแล้ว"
}
```

**Response (201):**
```json
{ "id": "clxxx...", "jobNo": "DD-20260527-001" }
```

**Error (422):** validation errors with field-level messages.  
**Error (500):** generic server error.

**Job number generation:** `DD-YYYYMMDD-NNN` where NNN is the count of jobs created on that date + 1, zero-padded to 3 digits.

---

## 6. Receipt Page (`/receipt/[id]`)

- Fetches the job by ID via Prisma on the server (Server Component).
- Displays all job fields in a clean Ant Design `Descriptions` layout.
- Includes a **Print** button that calls `window.print()`.
- Print CSS hides the Print button and browser chrome.
- If the ID is not found, renders a 404 page.

---

## 7. Database Schema (Prisma)

```prisma
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
  createdAt    DateTime @default(now())
}
```

---

## 8. Docker Production Setup

### File structure
```
ddcar/
├── Dockerfile
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── scripts/
│   └── entrypoint.sh     # runs prisma migrate deploy then starts app
└── .env.production       # DATABASE_URL, NODE_ENV
```

### `docker-compose.yml` services
| Service | Image | Port |
|---|---|---|
| `nginx` | nginx:alpine | 80:80 |
| `app` | local build | 3000 (internal) |
| `postgres` | postgres:16-alpine | 5432 (internal) |

### Nginx config
```nginx
server {
  listen 80;
  server_name ddreport.local;
  location / {
    proxy_pass http://app:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### One-time local setup
Add to `/etc/hosts`:
```
127.0.0.1 ddreport.local
```

---

## 9. Project Structure

```
ddcar/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # root layout, Ant Design ConfigProvider + Thai font
│   │   ├── page.tsx                # intake form (client component)
│   │   ├── receipt/
│   │   │   └── [id]/
│   │   │       └── page.tsx        # print receipt (server component)
│   │   └── api/
│   │       └── jobs/
│   │           └── route.ts        # POST /api/jobs handler
│   └── lib/
│       ├── prisma.ts               # Prisma client singleton
│       └── jobNo.ts                # job number generation logic
├── prisma/
│   └── schema.prisma
├── Dockerfile
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
└── scripts/
    └── entrypoint.sh
```

---

## 10. Out of Scope
- Authentication / user accounts
- Job list / dashboard
- Edit or delete jobs
- Email or SMS notifications
- Multi-language support
