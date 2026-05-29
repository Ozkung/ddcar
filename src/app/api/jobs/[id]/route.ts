import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/* ─── GET /api/jobs/[id] ─────────────────────────────────────────────────── */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: { images: { select: { id: true, filename: true } } },
    })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(job)
  } catch (err) {
    console.error('[GET /api/jobs/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/* ─── PATCH /api/jobs/[id] ───────────────────────────────────────────────── */
// Supports both full update (edit page) and partial update (e.g. status-only).
// Only fields present in the request body are updated.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()

    const existing = await prisma.job.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Build update payload — only include keys that were sent
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
