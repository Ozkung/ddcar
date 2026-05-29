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
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()

    const {
      date, time, customerName, phone,
      licensePlate, odometer, symptoms,
      notes, cause, totalPrice, status,
    } = body

    // Validate required fields
    const missing: string[] = []
    if (!date)             missing.push('date')
    if (!time)             missing.push('time')
    if (!customerName)     missing.push('customerName')
    if (!phone)            missing.push('phone')
    if (!licensePlate)     missing.push('licensePlate')
    if (odometer == null)  missing.push('odometer')
    if (!cause)            missing.push('cause')
    if (totalPrice == null) missing.push('totalPrice')
    if (!status)           missing.push('status')

    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Missing required fields', fields: missing },
        { status: 422 }
      )
    }

    const existing = await prisma.job.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const updated = await prisma.job.update({
      where: { id: params.id },
      data: {
        date,
        time,
        customerName,
        phone,
        licensePlate,
        odometer: Number(odometer),
        symptoms: Array.isArray(symptoms) ? symptoms : [],
        notes: notes || null,
        cause,
        totalPrice: Number(totalPrice),
        status,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/jobs/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
