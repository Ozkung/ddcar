import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId, id: userId } = session.user
  if (role === 'TECH') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const transfer = await prisma.stockTransfer.findUnique({ where: { id: params.id } })
  if (!transfer) return Response.json({ error: 'Not found' }, { status: 404 })

  if (transfer.toShopId !== shopId) {
    return Response.json({ error: 'เฉพาะปลายทางเท่านั้นที่ร้องขอได้' }, { status: 403 })
  }
  if (transfer.status !== 'IN_TRANSIT') {
    return Response.json({ error: 'ร้องขอได้เฉพาะสถานะ IN_TRANSIT เท่านั้น' }, { status: 422 })
  }

  const body = await req.json()
  const { message } = body
  if (!message?.trim()) {
    return Response.json({ error: 'กรุณาระบุรายละเอียด' }, { status: 422 })
  }

  await prisma.$transaction([
    prisma.stockTransfer.update({
      where: { id: params.id },
      data: { status: 'DISPUTED' },
    }),
    prisma.transferDispute.create({
      data: { transferId: params.id, raisedBy: userId, message: String(message).trim() },
    }),
  ])

  return Response.json({ ok: true })
}
