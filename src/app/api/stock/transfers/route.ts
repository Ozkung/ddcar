import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId } = session.user
    if (role === 'TECH') return Response.json({ error: 'Forbidden' }, { status: 403 })

    const type = req.nextUrl.searchParams.get('type') || undefined

    const transfers = await prisma.stockTransfer.findMany({
      where: {
        OR: [{ fromShopId: shopId }, { toShopId: shopId }],
        ...(type ? { type } : {}),
      },
      include: {
        fromShop: { select: { name: true } },
        toShop:   { select: { name: true } },
        items:    { include: { stockItem: { select: { name: true, unit: true } } } },
        disputes: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    })

    return Response.json(transfers)
  } catch (err) {
    console.error('[GET /api/stock/transfers]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId, id: userId } = session.user
    if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { toShopId, deliveryDate, note, items } = body

    if (!toShopId || !deliveryDate || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 422 })
    }
    if (toShopId === shopId) {
      return Response.json({ error: 'ปลายทางต้องไม่ใช่ร้านตัวเอง' }, { status: 422 })
    }

    // Fix #6: Validate deliveryDate before use
    const deliveryDateObj = new Date(deliveryDate)
    if (isNaN(deliveryDateObj.getTime())) {
      return Response.json({ error: 'วันที่ส่งถึงไม่ถูกต้อง' }, { status: 422 })
    }

    // Fix #2: Validate per-item quantity
    for (const item of items) {
      const qty = Number(item.quantity)
      if (!Number.isFinite(qty) || qty <= 0) {
        return Response.json({ error: 'จำนวนต้องเป็นตัวเลขที่มากกว่า 0' }, { status: 422 })
      }
    }

    // Validate all stock items belong to fromShop
    const stockIds = items.map((i: { stockItemId: string }) => i.stockItemId)
    const stockItems = await prisma.stockItem.findMany({
      where: { id: { in: stockIds }, shopId },
    })
    if (stockItems.length !== stockIds.length) {
      return Response.json({ error: 'อะไหล่บางรายการไม่พบในร้านนี้' }, { status: 422 })
    }

    let transfer
    try {
      transfer = await prisma.$transaction(async (tx) => {
        // Fix #3: Check availability inside transaction to prevent race condition
        for (const item of items as { stockItemId: string; quantity: number }[]) {
          const current = await tx.stockItem.findUnique({ where: { id: item.stockItemId } })
          if (!current) throw Object.assign(new Error('Not found'), { status: 404 })
          const available = current.quantity - current.reserved
          if (available < item.quantity) {
            throw Object.assign(new Error(`อะไหล่ "${current.name}" มีพร้อมใช้เพียง ${available} ${current.unit}`), { status: 422 })
          }
        }

        const created = await tx.stockTransfer.create({
          data: {
            type: 'BRANCH',
            fromShopId: shopId,
            toShopId,
            status: 'IN_TRANSIT',
            deliveryDate: deliveryDateObj,
            note: note || null,
            requestedBy: userId,
            items: {
              create: items.map((i: { stockItemId: string; quantity: number }) => ({
                stockItemId: i.stockItemId,
                quantity: i.quantity,
              })),
            },
          },
          include: { items: true },
        })

        // Soft reserve on fromShop items
        for (const item of items as { stockItemId: string; quantity: number }[]) {
          await tx.stockItem.update({
            where: { id: item.stockItemId },
            data: { reserved: { increment: item.quantity } },
          })
        }

        return created
      })
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e.status === 404) return Response.json({ error: 'Not found' }, { status: 404 })
      if (e.status === 422) return Response.json({ error: e.message }, { status: 422 })
      throw err
    }

    return Response.json(transfer, { status: 201 })
  } catch (err) {
    console.error('[POST /api/stock/transfers]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
