import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/* ─── GET /api/stock/[id] ────────────────────────────────────────────────────── */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId } = session.user
    if (role === 'TECH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const item = await prisma.stockItem.findFirst({
      where: { id: params.id, shopId },
      include: {
        adjustLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ ...item, availableQty: item.quantity - item.reserved })
  } catch (err) {
    console.error('[GET /api/stock/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/* ─── PATCH /api/stock/[id] ──────────────────────────────────────────────────── */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId } = session.user
    if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await prisma.stockItem.findFirst({ where: { id: params.id, shopId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {}

    if ('name'          in body) data.name          = String(body.name).trim()
    if ('category'      in body) data.category      = String(body.category).trim()
    if ('unit'          in body) data.unit          = String(body.unit).trim()
    if ('costPrice'     in body) data.costPrice     = Number(body.costPrice)
    if ('supplierPhone' in body) data.supplierPhone = body.supplierPhone || null
    if ('warrantyStart' in body) data.warrantyStart = body.warrantyStart ? new Date(body.warrantyStart) : null
    if ('warrantyEnd'   in body) data.warrantyEnd   = body.warrantyEnd   ? new Date(body.warrantyEnd)   : null

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 422 })
    }

    const updated = await prisma.stockItem.update({ where: { id: params.id }, data })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/stock/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
