import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const TERMINAL_STATUSES = ['ส่งมอบและเก็บเงินแล้ว', 'ยกเลิกรายการแล้ว']

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId, id: userId } = session.user
    if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { toShopId, note } = body
    if (!toShopId) return Response.json({ error: 'toShopId is required' }, { status: 422 })
    if (toShopId === shopId) {
      return Response.json({ error: 'ปลายทางต้องไม่ใช่ร้านตัวเอง' }, { status: 422 })
    }

    const job = await prisma.job.findFirst({
      where: { id: params.id, shopId },
      include: { transfer: true },
    })
    if (!job) return Response.json({ error: 'ไม่พบใบงาน' }, { status: 404 })

    if (job.transfer && (job.transfer.status === 'PENDING' || job.transfer.status === 'ACCEPTED')) {
      return Response.json({ error: 'ใบงานนี้มีการโอนที่ยังดำเนินการอยู่' }, { status: 422 })
    }

    if (TERMINAL_STATUSES.includes(job.status)) {
      return Response.json({ error: 'ไม่สามารถโอนใบงานที่เสร็จสิ้นหรือยกเลิกแล้ว' }, { status: 422 })
    }

    // Validate: toShopId must be a branch in the same family OR an accepted partner
    const currentShop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { parentId: true },
    })
    const rootId = currentShop?.parentId ?? shopId
    const familyShops = await prisma.shop.findMany({
      where: { OR: [{ id: rootId }, { parentId: rootId }] },
      select: { id: true },
    })
    const familyIds = new Set(familyShops.map(s => s.id))
    const isBranch = familyIds.has(toShopId)

    let isPartner = false
    if (!isBranch) {
      const partner = await prisma.shopPartner.findFirst({
        where: {
          OR: [
            { shopId, partnerId: toShopId, status: 'ACCEPTED' },
            { shopId: toShopId, partnerId: shopId, status: 'ACCEPTED' },
          ],
        },
      })
      isPartner = !!partner
    }

    if (!isBranch && !isPartner) {
      return Response.json(
        { error: 'toShopId ต้องเป็นสาขาในกลุ่มเดียวกันหรือพันธมิตรที่ยืนยันแล้ว' },
        { status: 422 }
      )
    }

    let transfer
    try {
      transfer = await prisma.$transaction(async (tx) => {
        if (job.transfer) {
          await tx.jobTransfer.delete({ where: { id: job.transfer.id } })
        }
        return tx.jobTransfer.create({
          data: {
            jobId: params.id,
            fromShopId: shopId,
            toShopId,
            previousJobStatus: job.status,
            requestedBy: userId,
            note: note || null,
          },
          include: {
            toShop: { select: { name: true, refCode: true } },
          },
        })
      })
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e.code === 'P2002') {
        return Response.json({ error: 'ใบงานนี้มีการโอนที่ยังดำเนินการอยู่' }, { status: 422 })
      }
      throw err
    }

    return Response.json(transfer, { status: 201 })
  } catch (err) {
    console.error('[POST /api/jobs/[id]/transfer]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId } = session.user

    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: { transfer: true },
    })
    if (!job?.transfer) return Response.json({ error: 'ไม่พบ transfer' }, { status: 404 })
    const transfer = job.transfer

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })
    const { action } = body as { action: string }

    // ── ACCEPT ─────────────────────────────────────────────────────────────────
    if (action === 'accept') {
      if (transfer.toShopId !== shopId) {
        return Response.json({ error: 'เฉพาะร้านปลายทางเท่านั้นที่รับงานได้' }, { status: 403 })
      }
      if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN' && role !== 'LEAD_TECH') {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transfer.status !== 'PENDING') {
        return Response.json({ error: 'รับได้เฉพาะ transfer ที่ PENDING เท่านั้น' }, { status: 422 })
      }
      try {
        await prisma.$transaction(async (tx) => {
          const result = await tx.jobTransfer.updateMany({
            where: { id: transfer.id, status: 'PENDING' },
            data: { status: 'ACCEPTED' },
          })
          if (result.count === 0) throw Object.assign(new Error('ALREADY_PROCESSED'), { status: 422 })
          await tx.job.update({ where: { id: params.id }, data: { status: 'ถ่ายงานออก' } })
        })
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string }
        if (e.status === 422) return Response.json({ error: 'transfer ถูกดำเนินการไปแล้ว' }, { status: 422 })
        throw err
      }
      return Response.json({ ok: true })
    }

    // ── REJECT ─────────────────────────────────────────────────────────────────
    if (action === 'reject') {
      if (transfer.toShopId !== shopId) {
        return Response.json({ error: 'เฉพาะร้านปลายทางเท่านั้นที่ปฏิเสธได้' }, { status: 403 })
      }
      if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN' && role !== 'LEAD_TECH') {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transfer.status !== 'PENDING') {
        return Response.json({ error: 'ปฏิเสธได้เฉพาะ transfer ที่ PENDING เท่านั้น' }, { status: 422 })
      }
      try {
        await prisma.$transaction(async (tx) => {
          const result = await tx.jobTransfer.updateMany({
            where: { id: transfer.id, status: 'PENDING' },
            data: { status: 'REJECTED' },
          })
          if (result.count === 0) throw Object.assign(new Error('ALREADY_PROCESSED'), { status: 422 })
          await tx.job.update({ where: { id: params.id }, data: { status: transfer.previousJobStatus } })
        })
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string }
        if (e.status === 422) return Response.json({ error: 'transfer ถูกดำเนินการไปแล้ว' }, { status: 422 })
        throw err
      }
      return Response.json({ ok: true })
    }

    // ── CANCEL ─────────────────────────────────────────────────────────────────
    if (action === 'cancel') {
      if (transfer.fromShopId !== shopId && role !== 'SUPER_ADMIN') {
        return Response.json({ error: 'เฉพาะร้านต้นทางเท่านั้นที่ยกเลิกได้' }, { status: 403 })
      }
      if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transfer.status !== 'PENDING') {
        return Response.json(
          { error: 'ยกเลิกได้เฉพาะ transfer ที่ PENDING เท่านั้น (ยกเลิกหลัง ACCEPTED ไม่ได้)' },
          { status: 422 }
        )
      }
      try {
        await prisma.$transaction(async (tx) => {
          const result = await tx.jobTransfer.updateMany({
            where: { id: transfer.id, status: 'PENDING' },
            data: { status: 'CANCELLED' },
          })
          if (result.count === 0) throw Object.assign(new Error('ALREADY_PROCESSED'), { status: 422 })
          await tx.job.update({ where: { id: params.id }, data: { status: transfer.previousJobStatus } })
        })
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string }
        if (e.status === 422) return Response.json({ error: 'transfer ถูกดำเนินการไปแล้ว' }, { status: 422 })
        throw err
      }
      return Response.json({ ok: true })
    }

    return Response.json(
      { error: 'action ต้องเป็น accept, reject, หรือ cancel' },
      { status: 422 }
    )
  } catch (err) {
    console.error('[PATCH /api/jobs/[id]/transfer]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
