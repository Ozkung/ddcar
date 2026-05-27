# ดีดีช่างยนต์ — Intake Form Design Spec
**Date:** 2026-05-27  
**Stack:** Next.js 14 (App Router) · Ant Design 5 · Prisma · PostgreSQL · Docker · Nginx  
**Domain:** `ddreport.local` (local network only, no auth)

---

## 1. Goals

Build a Thai-language car-repair intake form for shop staff to log vehicle jobs. After submission the system auto-assigns a job number and renders a print-friendly receipt. A report page shows all submitted jobs in a searchable, filterable, paginated table with CSV export. All data is stored in PostgreSQL. The app is self-hosted via Docker Compose on a local machine and accessed at `http://ddreport.local`.

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
| `/` | 5-step Ant Design wizard — intake form |
| `/report` | Job report table with search, filter, pagination, CSV export |
| `/receipt/[id]` | Print-friendly job summary page |

---

## 4. Intake Form — 5-Step Wizard

Uses Ant Design `Steps` + `Form` with client-side state held in `useState` (all steps share one form instance via `Form.useForm()`). Images are held separately in a `fileList` state (Ant Design `Upload`).

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

### Step 5 — อัปโหลดรูปภาพ (Upload Images)
| Field | Type | Notes |
|---|---|---|
| รูปภาพ | Ant Design `Upload` (dragger) | Optional, max 10 files, accepted: jpg/png/webp, max 5 MB each |

Images are previewed as thumbnails before submission. Upload is optional — staff can skip and submit without images.

**Navigation:** Back/Next buttons between steps. The Next button validates only the current step's fields before advancing. **Submit** button on Step 5 triggers a two-phase submission:
1. `POST /api/jobs` with all text fields → receives `{ id, jobNo }`
2. If images selected → `POST /api/jobs/[id]/images` with `multipart/form-data`
3. Navigate to `/receipt/[id]`

---

## 5. API Routes

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

### `GET /api/jobs`

Returns a paginated, filtered list of jobs for the report page.

**Query parameters:**
| Param | Type | Description |
|---|---|---|
| `page` | number | Page number, default `1` |
| `pageSize` | number | Records per page, default `20` |
| `search` | string | Full-text match against `customerName` or `licensePlate` |
| `status` | string | Filter by exact status value |
| `dateFrom` | string | Filter jobs with `date >= dateFrom` (YYYY-MM-DD) |
| `dateTo` | string | Filter jobs with `date <= dateTo` (YYYY-MM-DD) |

**Response (200):**
```json
{
  "data": [ { ...job fields... } ],
  "total": 142,
  "page": 1,
  "pageSize": 20
}
```

---

---

### `POST /api/jobs/[id]/images`

Accepts `multipart/form-data` with one or more image files (field name: `images`). Saves files to `/uploads/[jobId]/` inside the app container (Docker volume `uploads_data`). Creates one `Image` record per file in the database.

**Constraints:** max 10 files per job, max 5 MB per file, accepted types: `image/jpeg`, `image/png`, `image/webp`.

**Response (201):**
```json
{ "uploaded": 3 }
```

---

### `GET /api/uploads/[...path]`

Serves uploaded image files from the filesystem. Next.js API route reads the file from `/uploads/[...path]` and streams it with the correct `Content-Type`. This avoids exposing the raw filesystem outside the container.

---

### `GET /api/jobs/export`

Returns all matching jobs (same filter params as above, no pagination) as a CSV download.

**Response:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="jobs-YYYYMMDD.csv"`

CSV columns: `jobNo, date, time, customerName, phone, licensePlate, odometer, symptoms, notes, cause, totalPrice, status, createdAt`

---

## 6. Report Page (`/report`)

A client component that fetches from `GET /api/jobs` and renders an Ant Design `Table`.

**Filter bar (above table):**
- Text search input — searches `customerName` and `licensePlate` simultaneously
- Date range picker — filters by `dateFrom` / `dateTo`
- Status select — filters by job status
- **Export CSV** button — calls `GET /api/jobs/export` with current filters, triggers browser download

**Table columns:**
| Column | Field | Notes |
|---|---|---|
| เลขที่ใบงาน | `jobNo` | Clickable — opens `/receipt/[id]` in new tab |
| วันที่ | `date` | |
| ชื่อลูกค้า | `customerName` | |
| ทะเบียนรถ | `licensePlate` | |
| อาการ | `symptoms` | Joined as comma-separated string |
| ราคาสุทธิ | `totalPrice` | Right-aligned, formatted with `,` separator |
| สถานะ | `status` | Ant Design `Tag` with color per status |
| | actions | View receipt icon button |

**Pagination:** Ant Design `Table` built-in pagination, 20 rows/page, synced with `page`/`pageSize` query params so the URL is shareable.

**Status tag colors:**
- ลูกค้าอนุมัติซ่อมแล้ว → `blue`
- ซ่อมเสร็จเรียบร้อยแล้ว → `orange`
- ส่งมอบและเก็บเงินแล้ว → `green`

---

## 7. Receipt Page (`/receipt/[id]`)

- Fetches the job by ID (including related `images`) via Prisma on the server (Server Component).
- Displays all job fields in a clean Ant Design `Descriptions` layout.
- If the job has images, renders them below the details as an Ant Design `Image.PreviewGroup` gallery (thumbnail grid, click to zoom).
- Image URLs use `/api/uploads/[jobId]/[filename]`.
- Includes a **Print** button that calls `window.print()`.
- Print CSS hides the Print button and browser chrome; images print inline.
- If the ID is not found, renders a 404 page.

---

## 8. Database Schema (Prisma)

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
  images       Image[]
}

model Image {
  id        String   @id @default(cuid())
  jobId     String
  filename  String               // stored filename, e.g. "abc123.jpg"
  createdAt DateTime @default(now())
  job       Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
}
```

Images are served at `/api/uploads/[jobId]/[filename]`.

---

## 9. Docker Production Setup

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
| Service | Image | Port | Volume |
|---|---|---|---|
| `nginx` | nginx:alpine | 80:80 | — |
| `app` | local build | 3000 (internal) | `uploads_data:/uploads` |
| `postgres` | postgres:16-alpine | 5432 (internal) | `pg_data:/var/lib/postgresql/data` |

`uploads_data` is a named Docker volume that persists uploaded images across container restarts.

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

## 10. Project Structure

```
ddcar/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # root layout, Ant Design ConfigProvider + Thai font
│   │   ├── page.tsx                # intake form (client component)
│   │   ├── report/
│   │   │   └── page.tsx            # report table (client component)
│   │   ├── receipt/
│   │   │   └── [id]/
│   │   │       └── page.tsx        # print receipt (server component)
│   │   └── api/
│   │       ├── jobs/
│   │       │   ├── route.ts            # POST /api/jobs, GET /api/jobs
│   │       │   ├── [id]/
│   │       │   │   └── images/
│   │       │   │       └── route.ts    # POST /api/jobs/[id]/images
│   │       │   └── export/
│   │       │       └── route.ts        # GET /api/jobs/export (CSV)
│   │       └── uploads/
│   │           └── [...path]/
│   │               └── route.ts        # GET /api/uploads/[...path] (file serving)
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

## 11. Out of Scope
- Authentication / user accounts
- Edit or delete jobs
- Email or SMS notifications
- Multi-language support
