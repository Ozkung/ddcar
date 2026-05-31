import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId, id: userId } = session.user
    if (role === 'TECH') return Response.json({ error: 'Forbidden' }, { status: 403 })

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: params.id },
      include: { items: { include: { stockItem: true } } },
    })
    if (!transfer) return Response.json({ error: 'Not found' }, { status: 404 })

    if (transfer.fromShopId !== shopId && transfer.toShopId !== shopId) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json()
    const { status } = body

    // ── PARTNER_SALE: destination approves → IN_TRANSIT + soft reserve ──────
    if (status === 'IN_TRANSIT' && transfer.type === 'PARTNER_SALE') {
      if (transfer.toShopId !== shopId) {
        return Response.json({ error: 'เฉพาะผู้ซื้อ (ปลายทาง) เท่านั้นที่อนุมัติได้' }, { status: 403 })
      }
      if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transfer.status !== 'PENDING') {
        return Response.json({ error: 'อนุมัติได้เฉพาะ status PENDING เท่านั้น' }, { status: 422 })
      }

      try {
        await prisma.$transaction(async (tx) => {
          await tx.stockTransfer.update({
            where: { id: params.id },
            data: { status: 'IN_TRANSIT' },
          })
          for (const item of transfer.items) {
            const current = await tx.stockItem.findUnique({ where: { id: item.stockItemId } })
            if (!current || current.quantity - current.reserved < item.quantity) {
              throw Object.assign(
                new Error(`อะไหล่ "${item.stockItem.name}" มีไม่พอสำหรับการอนุมัติ`),
                { status: 422 }
              )
            }
            await tx.stockItem.update({
              where: { id: item.stockItemId },
              data: { reserved: { increment: item.quantity } },
            })
          }
        })
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string }
        if (e.status === 422) return Response.json({ error: e.message }, { status: 422 })
        throw err
      }

      return Response.json({ ok: true })
    }

    // ── PARTNER_SALE: destination rejects → REJECTED ─────────────────────────
    if (status === 'REJECTED') {
      if (transfer.type !== 'PARTNER_SALE') {
        return Response.json({ error: 'REJECTED ใช้ได้เฉพาะ PARTNER_SALE เท่านั้น' }, { status: 422 })
      }
      if (transfer.toShopId !== shopId) {
        return Response.json({ error: 'เฉพาะผู้ซื้อ (ปลายทาง) เท่านั้นที่ปฏิเสธได้' }, { status: 403 })
      }
      if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transfer.status !== 'PENDING') {
        return Response.json({ error: 'ปฏิเสธได้เฉพาะ status PENDING เท่านั้น' }, { status: 422 })
      }

      await prisma.stockTransfer.update({
        where: { id: params.id },
        data: { status: 'REJECTED' },
      })

      return Response.json({ ok: true })
    }

    // ── DELIVERED: destination confirms receipt ───────────────────────────────
    if (status === 'DELIVERED') {
      if (transfer.toShopId !== shopId) {
        return Response.json({ error: 'เฉพาะปลายทางเท่านั้นที่ยืนยันรับได้' }, { status: 403 })
      }
      if (transfer.status !== 'IN_TRANSIT' && transfer.status !== 'DISPUTED') {
        return Response.json({ error: 'สถานะปัจจุบันไม่สามารถยืนยันรับได้' }, { status: 422 })
      }

      try {
        await prisma.$transaction(async (tx) => {
          await tx.stockTransfer.update({
            where: { id: params.id },
            data: { status: 'DELIVERED', receivedAt: new Date() },
          })

          for (const item of transfer.items) {
            const current = await tx.stockItem.findUnique({ where: { id: item.stockItemId } })
            if (!current || current.quantity < item.quantity || current.reserved < item.quantity) {
              throw Object.assign(new Error('จำนวนในคลังไม่เพียงพอสำหรับการยืนยันรับของ'), { status: 422 })
            }

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
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string }
        if (e.status === 422) return Response.json({ error: e.message }, { status: 422 })
        throw err
      }

      return Response.json({ ok: true })
    }

    // ── CANCELLED ─────────────────────────────────────────────────────────────
    if (status === 'CANCELLED') {
      if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transfer.fromShopId !== shopId && role !== 'SUPER_ADMIN') {
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
        // Only release reserved if stock was already reserved (IN_TRANSIT or DISPUTED)
        // PENDING status means no stock was reserved yet
        if (transfer.status === 'IN_TRANSIT' || transfer.status === 'DISPUTED') {
          for (const item of transfer.items) {
            await tx.stockItem.update({
              where: { id: item.stockItemId },
              data: { reserved: { decrement: item.quantity } },
            })
          }
        }
      })

      return Response.json({ ok: true })
    }

    return Response.json({ error: 'status ที่รองรับ: IN_TRANSIT (approve), REJECTED, DELIVERED, CANCELLED' }, { status: 422 })
  } catch (err) {
    console.error('[PATCH /api/stock/transfers/[id]]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
