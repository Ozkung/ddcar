import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

/* ─── GET /api/jobs/[id] ─────────────────────────────────────────────────── */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.job.findFirst({
      where: { id: params.id, shopId: session.user.shopId },
      include: {
        images: { select: { id: true, filename: true } },
        jobParts: {
          include: { stockItem: { select: { id: true, name: true, category: true, unit: true } } },
        },
      },
    })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(job)
  } catch (err) {
    console.error('[GET /api/jobs/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/* ─── PATCH /api/jobs/[id] ───────────────────────────────────────────────── */
// Handles full update (edit page) and partial update (status-only).
// Status transitions trigger stock deduction logic:
//   อยู่ระหว่างดำเนินการ (none → reserved): soft-reserve parts
//   ส่งมอบและเก็บเงินแล้ว (reserved → deducted): hard-deduct parts
//   ยกเลิกรายการแล้ว (reserved → none): release soft reserve
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { shopId, role, id: userId } = session.user

    const existing = await prisma.job.findFirst({
      where: { id: params.id, shopId },
      include: { jobParts: true },
    })
    if (!existing) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    if (role === 'TECH' && existing.createdBy !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
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
    if ('assignedTo'   in body) data.assignedTo   = body.assignedTo || null

    // Parts update (only allowed when stockStatus === 'none')
    let newParts: { stockItemId: string; quantity: number }[] | null = null
    if ('parts' in body && existing.stockStatus === 'none') {
      newParts = body.parts as { stockItemId: string; quantity: number }[]
    }

    // Determine stock action from status transition
    const newStatus = 'status' in body ? String(body.status) : null
    const currentStockStatus = existing.stockStatus

    type StockAction = 'reserve' | 'deduct' | 'release' | null
    let stockAction: StockAction = null

    if (newStatus && newStatus !== existing.status) {
      if (newStatus === 'อยู่ระหว่างดำเนินการ' && currentStockStatus === 'none') {
        stockAction = 'reserve'
      } else if (newStatus === 'ส่งมอบและเก็บเงินแล้ว' && currentStockStatus === 'reserved') {
        stockAction = 'deduct'
      } else if (newStatus === 'ยกเลิกรายการแล้ว' && currentStockStatus === 'reserved') {
        stockAction = 'release'
      }
    }

    if (Object.keys(data).length === 0 && newParts === null && !stockAction) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 422 })
    }

    let updated
    try {
    updated = await prisma.$transaction(async (tx) => {
      // Update parts if applicable
      if (newParts !== null) {
        await tx.jobPart.deleteMany({ where: { jobId: params.id } })
        if (newParts.length > 0) {
          await tx.jobPart.createMany({
            data: newParts.map(p => ({
              jobId: params.id,
              stockItemId: p.stockItemId,
              quantity: p.quantity,
            })),
          })
        }
      }

      // Determine which parts to process for stock actions
      const partsToProcess = newParts !== null
        ? newParts
        : existing.jobParts.map(p => ({ stockItemId: p.stockItemId, quantity: p.quantity }))

      if (stockAction === 'reserve') {
        for (const part of partsToProcess) {
          const affected = await tx.$executeRaw`
            UPDATE "StockItem"
            SET reserved = reserved + ${part.quantity}
            WHERE id = ${part.stockItemId}
              AND "shopId" = ${shopId}
              AND (quantity - reserved) >= ${part.quantity}
          `
          if (affected === 0) {
            const item = await tx.stockItem.findFirst({ where: { id: part.stockItemId, shopId } })
            if (!item) throw Object.assign(new Error('ไม่พบอะไหล่นี้ในร้าน'), { status: 404 })
            const avail = item.quantity - item.reserved
            throw Object.assign(
              new Error(`อะไหล่ "${item.name}" มีพร้อมใช้เพียง ${avail} ${item.unit}`),
              { status: 422 }
            )
          }
        }
        data.stockStatus = 'reserved'
      } else if (stockAction === 'deduct') {
        for (const part of partsToProcess) {
          const affected = await tx.$executeRaw`
            UPDATE "StockItem"
            SET quantity = quantity - ${part.quantity},
                reserved = reserved - ${part.quantity}
            WHERE id = ${part.stockItemId}
              AND "shopId" = ${shopId}
              AND quantity >= ${part.quantity}
              AND reserved >= ${part.quantity}
          `
          if (affected === 0) {
            const item = await tx.stockItem.findFirst({ where: { id: part.stockItemId, shopId } })
            if (!item) throw Object.assign(new Error('ไม่พบอะไหล่นี้ในร้าน'), { status: 404 })
            throw Object.assign(
              new Error(`อะไหล่ "${item.name}" จำนวนในคลังหรือจองไม่พอสำหรับการตัดยอด`),
              { status: 422 }
            )
          }
          await tx.stockAdjustLog.create({
            data: {
              stockItemId: part.stockItemId,
              delta: -part.quantity,
              reason: `job:${params.id}`,
              userId,
            },
          })
        }
        data.stockStatus = 'deducted'
      } else if (stockAction === 'release') {
        for (const part of partsToProcess) {
          // Only release stock that belongs to this shop
          const affected = await tx.$executeRaw`
            UPDATE "StockItem"
            SET reserved = reserved - ${part.quantity}
            WHERE id = ${part.stockItemId}
              AND "shopId" = ${shopId}
              AND reserved >= ${part.quantity}
          `
          if (affected === 0) {
            // If item not found in shop or reserved underflows, skip silently
            // (job cancellation should not fail due to stale stock state)
          }
        }
        data.stockStatus = 'none'
      }

      return tx.job.update({
        where: { id: params.id },
        data,
        include: {
          jobParts: { include: { stockItem: { select: { id: true, name: true, unit: true } } } },
        },
      })
    })
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e.status === 404) return NextResponse.json({ error: e.message ?? 'Not found' }, { status: 404 })
      if (e.status === 422) return NextResponse.json({ error: e.message }, { status: 422 })
      throw err
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/jobs/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
