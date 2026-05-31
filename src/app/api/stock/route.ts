import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/* ─── GET /api/stock ────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { shopId } = session.user
    const available = req.nextUrl.searchParams.get('available') === 'true'

    const items = await prisma.stockItem.findMany({
      where: { shopId },
      orderBy: { name: 'asc' },
    })

    const result = items.map(i => ({ ...i, availableQty: i.quantity - i.reserved }))
    return NextResponse.json(available ? result.filter(i => i.availableQty > 0) : result)
  } catch (err) {
    console.error('[GET /api/stock]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/* ─── POST /api/stock ───────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId } = session.user
    if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, category, unit, quantity, costPrice, supplierPhone, warrantyStart, warrantyEnd } = body

    if (!name?.trim() || !category?.trim() || !unit?.trim() || quantity == null || costPrice == null) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 422 })
    }

    const item = await prisma.stockItem.create({
      data: {
        shopId,
        name: String(name).trim(),
        category: String(category).trim(),
        unit: String(unit).trim(),
        quantity: Number(quantity),
        costPrice: Number(costPrice),
        supplierPhone: supplierPhone ? String(supplierPhone).trim() : null,
        warrantyStart: warrantyStart ? new Date(warrantyStart) : null,
        warrantyEnd: warrantyEnd ? new Date(warrantyEnd) : null,
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    console.error('[POST /api/stock]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
