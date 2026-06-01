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

    // Delete stale REJECTED/CANCELLED transfer if present
    if (job.transfer) {
      await prisma.jobTransfer.delete({ where: { id: job.transfer.id } })
    }

    const transfer = await prisma.jobTransfer.create({
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

    return Response.json(transfer, { status: 201 })
  } catch (err) {
    console.error('[POST /api/jobs/[id]/transfer]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
