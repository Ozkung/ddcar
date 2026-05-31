import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId, id: userId } = session.user
  if (role === 'TECH') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: params.id },
    include: { items: { include: { stockItem: true } } },
  })
  if (!transfer) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { status } = body

  if (status === 'DELIVERED') {
    if (transfer.toShopId !== shopId) {
      return Response.json({ error: 'เฉพาะปลายทางเท่านั้นที่ยืนยันรับได้' }, { status: 403 })
    }
    if (transfer.status !== 'IN_TRANSIT' && transfer.status !== 'DISPUTED') {
      return Response.json({ error: 'สถานะปัจจุบันไม่สามารถยืนยันรับได้' }, { status: 422 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockTransfer.update({
        where: { id: params.id },
        data: { status: 'DELIVERED', receivedAt: new Date() },
      })

      for (const item of transfer.items) {
        // Deduct from source shop
        await tx.stockItem.update({
          where: { id: item.stockItemId },
          data: {
            quantity: { decrement: item.quantity },
            reserved: { decrement: item.quantity },
          },
        })
        await tx.stockAdjustLog.create({
          data: {
            stockItemId: item.stockItemId,
            delta: -item.quantity,
            reason: `transfer:${params.id}`,
            userId,
          },
        })

        // Add to destination shop — find or create matching item by name
        const destItem = await tx.stockItem.findFirst({
          where: { shopId: transfer.toShopId, name: item.stockItem.name },
        })
        if (destItem) {
          await tx.stockItem.update({
            where: { id: destItem.id },
            data: { quantity: { increment: item.quantity } },
          })
          await tx.stockAdjustLog.create({
            data: {
              stockItemId: destItem.id,
              delta: item.quantity,
              reason: `transfer:${params.id}`,
              userId,
            },
          })
        } else {
          const newItem = await tx.stockItem.create({
            data: {
              shopId: transfer.toShopId,
              name: item.stockItem.name,
              category: item.stockItem.category,
              unit: item.stockItem.unit,
              quantity: item.quantity,
              costPrice: item.stockItem.costPrice,
            },
          })
          await tx.stockAdjustLog.create({
            data: {
              stockItemId: newItem.id,
              delta: item.quantity,
              reason: `transfer:${params.id}`,
              userId,
            },
          })
        }
      }
    })

    return Response.json({ ok: true })
  }

  if (status === 'CANCELLED') {
    if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (transfer.fromShopId !== shopId) {
      return Response.json({ error: 'เฉพาะต้นทางเท่านั้นที่ยกเลิกได้' }, { status: 403 })
    }
    if (transfer.status === 'DELIVERED') {
      return Response.json({ error: 'ไม่สามารถยกเลิก transfer ที่ส่งแล้ว' }, { status: 422 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockTransfer.update({
        where: { id: params.id },
        data: { status: 'CANCELLED' },
      })
      for (const item of transfer.items) {
        await tx.stockItem.update({
          where: { id: item.stockItemId },
          data: { reserved: { decrement: item.quantity } },
        })
      }
    })

    return Response.json({ ok: true })
  }

  return Response.json({ error: 'status ที่รองรับ: DELIVERED, CANCELLED' }, { status: 422 })
}
