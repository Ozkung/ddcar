import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function csvEscape(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search   = searchParams.get('search')   || ''
    const status   = searchParams.get('status')   || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo   = searchParams.get('dateTo')   || ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
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

    const jobs = await prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const HEADERS = [
      'jobNo','date','time','customerName','phone',
      'licensePlate','odometer','symptoms','notes',
      'cause','totalPrice','status','createdAt',
    ]

    const rows = jobs.map(j =>
      [
        j.jobNo, j.date, j.time, j.customerName, j.phone,
        j.licensePlate, j.odometer, j.symptoms.join('; '), j.notes ?? '',
        j.cause, j.totalPrice, j.status, j.createdAt.toISOString(),
      ].map(csvEscape).join(',')
    )

    const csv = '﻿' + [HEADERS.join(','), ...rows].join('\r\n') // BOM for Excel Thai
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="jobs-${dateStamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[GET /api/jobs/export]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
