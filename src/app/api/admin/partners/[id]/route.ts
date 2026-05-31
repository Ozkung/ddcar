import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId } = session.user
    if (role === 'TECH' || role === 'LEAD_TECH') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const record = await prisma.shopPartner.findUnique({ where: { id: params.id } })
    if (!record) return Response.json({ error: 'Not found' }, { status: 404 })

    // Must be the target (or SUPER_ADMIN) to accept
    if (role !== 'SUPER_ADMIN' && record.partnerId !== shopId) {
      return Response.json({ error: 'เฉพาะผู้รับคำขอเท่านั้นที่อนุมัติได้' }, { status: 403 })
    }
    if (record.status !== 'PENDING') {
      return Response.json({ error: 'รับได้เฉพาะคำขอที่ยังรออยู่ (PENDING) เท่านั้น' }, { status: 422 })
    }

    // Accept: update this row + create reverse ACCEPTED row
    await prisma.$transaction([
      prisma.shopPartner.update({
        where: { id: record.id },
        data: { status: 'ACCEPTED' },
      }),
      prisma.shopPartner.create({
        data: { shopId: record.partnerId, partnerId: record.shopId, status: 'ACCEPTED' },
      }),
    ])

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/admin/partners/[id]]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId } = session.user
    if (role === 'TECH' || role === 'LEAD_TECH') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const record = await prisma.shopPartner.findUnique({ where: { id: params.id } })
    if (!record) return Response.json({ error: 'Not found' }, { status: 404 })

    // Must belong to the relationship (or SUPER_ADMIN)
    if (role !== 'SUPER_ADMIN' && record.shopId !== shopId && record.partnerId !== shopId) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    // Delete both directions atomically
    await prisma.$transaction([
      prisma.shopPartner.delete({ where: { id: record.id } }),
      prisma.shopPartner.deleteMany({
        where: { shopId: record.partnerId, partnerId: record.shopId },
      }),
    ])

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/admin/partners/[id]]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
