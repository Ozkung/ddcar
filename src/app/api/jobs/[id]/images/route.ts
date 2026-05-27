import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'

const UPLOADS_DIR  = process.env.UPLOADS_DIR  || '/uploads'
const MAX_FILES    = 10
const MAX_SIZE     = 5 * 1024 * 1024           // 5 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await prisma.job.findUnique({ where: { id: params.id } })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const files = formData.getAll('images') as File[]

    if (files.length === 0) {
      return NextResponse.json({ uploaded: 0 }, { status: 200 })
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} images per job` }, { status: 422 })
    }

    // ── Validate ALL files before writing any (prevents orphaned files) ──────
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 422 })
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: `File too large: ${file.name} (max 5 MB)` }, { status: 422 })
      }
    }

    // ── Pre-read all buffers (so we don't partially write if arrayBuffer fails) ─
    const prepared: { filename: string; buffer: Buffer }[] = []
    for (const file of files) {
      const ext      = EXT_MAP[file.type]
      const filename = `${randomUUID()}.${ext}`
      const buffer   = Buffer.from(await file.arrayBuffer())
      prepared.push({ filename, buffer })
    }

    // ── Write files ──────────────────────────────────────────────────────────
    const jobDir = path.join(UPLOADS_DIR, params.id)
    await mkdir(jobDir, { recursive: true })

    const records: { jobId: string; filename: string }[] = []
    for (const { filename, buffer } of prepared) {
      await writeFile(path.join(jobDir, filename), buffer)
      records.push({ jobId: params.id, filename })
    }

    await prisma.image.createMany({ data: records })

    return NextResponse.json({ uploaded: records.length }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/jobs/[id]/images]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
