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

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { toShopId, deliveryDate, note, items, type = 'BRANCH', unitPrice } = body

    if (!toShopId || !deliveryDate || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 422 })
    }
    if (toShopId === shopId) {
      return Response.json({ error: 'ปลายทางต้องไม่ใช่ร้านตัวเอง' }, { status: 422 })
    }
    if (type !== 'BRANCH' && type !== 'PARTNER_SALE') {
      return Response.json({ error: 'type ต้องเป็น BRANCH หรือ PARTNER_SALE' }, { status: 422 })
    }

    // PARTNER_SALE: validate unitPrice + partner relationship
    if (type === 'PARTNER_SALE') {
      const numPrice = Number(unitPrice)
      if (!Number.isFinite(numPrice) || numPrice <= 0) {
        return Response.json({ error: 'PARTNER_SALE ต้องระบุราคาต่อหน่วย (unitPrice > 0)' }, { status: 422 })
      }
      const partner = await prisma.shopPartner.findFirst({
        where: { shopId, partnerId: toShopId, status: 'ACCEPTED' },
      })
      if (!partner) {
        return Response.json({ error: 'ร้านนี้ไม่ใช่พันธมิตรของท่าน' }, { status: 422 })
      }
    }

    const deliveryDateObj = new Date(deliveryDate)
    if (isNaN(deliveryDateObj.getTime())) {
      return Response.json({ error: 'วันที่ส่งถึงไม่ถูกต้อง' }, { status: 422 })
    }

    for (const item of items) {
      const qty = Number(item.quantity)
      if (!Number.isFinite(qty) || qty <= 0) {
        return Response.json({ error: 'จำนวนต้องเป็นตัวเลขที่มากกว่า 0' }, { status: 422 })
      }
    }

    const stockIds = items.map((i: { stockItemId: string }) => i.stockItemId)
    const stockItems = await prisma.stockItem.findMany({
      where: { id: { in: stockIds }, shopId },
    })
    if (stockItems.length !== stockIds.length) {
      return Response.json({ error: 'อะไหล่บางรายการไม่พบในร้านนี้' }, { status: 422 })
    }

    // BRANCH → IN_TRANSIT immediately with stock reservation
    // PARTNER_SALE → PENDING, no stock impact
    const initialStatus = type === 'BRANCH' ? 'IN_TRANSIT' : 'PENDING'

    let transfer
    try {
      transfer = await prisma.$transaction(async (tx) => {
        const created = await tx.stockTransfer.create({
          data: {
            type,
            fromShopId: shopId,
            toShopId,
            status: initialStatus,
            deliveryDate: deliveryDateObj,
            note: note || null,
            requestedBy: userId,
            unitPrice: type === 'PARTNER_SALE' ? Number(unitPrice) : null,
            items: {
              create: items.map((i: { stockItemId: string; quantity: number }) => ({
                stockItemId: i.stockItemId,
                quantity: i.quantity,
              })),
            },
          },
          include: { items: true },
        })

        if (type === 'BRANCH') {
          for (const item of items as { stockItemId: string; quantity: number }[]) {
            const affected = await tx.$executeRaw`
              UPDATE "StockItem"
              SET reserved = reserved + ${item.quantity}
              WHERE id = ${item.stockItemId}
                AND "shopId" = ${shopId}
                AND (quantity - reserved) >= ${item.quantity}
            `
            if (affected === 0) {
              const current = await tx.stockItem.findUnique({ where: { id: item.stockItemId } })
              const avail = current ? current.quantity - current.reserved : 0
              throw Object.assign(
                new Error(`อะไหล่ "${current?.name ?? item.stockItemId}" มีพร้อมใช้เพียง ${avail} ${current?.unit ?? ''}`),
                { status: 422 }
              )
            }
          }
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
