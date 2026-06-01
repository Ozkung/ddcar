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
      assignedTo, parts,
    } = body

    const missing = [date, time, customerName, phone, licensePlate, odometer, cause, totalPrice, status]
      .some(v => v === undefined || v === null || v === '')
    if (missing) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 422 })
    }

    const jobNo = await generateJobNo(date as string)

    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.job.create({
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
          assignedTo: assignedTo || null,
        },
      })

      if (Array.isArray(parts) && parts.length > 0) {
        await tx.jobPart.createMany({
          data: (parts as { stockItemId: string; quantity: number }[]).map(p => ({
            jobId: created.id,
            stockItemId: p.stockItemId,
            quantity: p.quantity,
          })),
        })
      }

      return created
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
    const page     = isNaN(pageRaw)     ? 1   : Math.max(1, pageRaw)
    const pageSize = isNaN(pageSizeRaw) ? 20  : Math.min(100, Math.max(1, pageSizeRaw))
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
        include: {
          images: { select: { id: true, filename: true } },
          transfer: {
            select: {
              status: true,
              toShop: { select: { name: true, refCode: true } },
              fromShop: { select: { name: true, refCode: true } },
            },
          },
        },
      }),
      prisma.job.count({ where }),
    ])

    return NextResponse.json({ data, total, page, pageSize })
  } catch (err) {
    console.error('[GET /api/jobs]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
