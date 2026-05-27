import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/uploads'

const CONTENT_TYPES: Record<string, string> = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const requested = path.join(UPLOADS_DIR, ...params.path)
    const resolved  = path.resolve(requested)
    const base      = path.resolve(UPLOADS_DIR)

    // Prevent path traversal attacks
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const buffer      = await readFile(resolved)
    const ext         = path.extname(resolved).slice(1).toLowerCase()
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
