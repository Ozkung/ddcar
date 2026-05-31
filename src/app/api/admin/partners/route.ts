import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId } = session.user
    if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (role === 'SUPER_ADMIN') {
      const records = await prisma.shopPartner.findMany({
        include: {
          shop:    { select: { id: true, name: true } },
          partner: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      })
      return Response.json(records.filter(r => r.shopId < r.partnerId))
    }

    // SHOP_ADMIN: own partners only — include shop for consistent shape
    const records = await prisma.shopPartner.findMany({
      where: { shopId },
      include: {
        shop:    { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return Response.json(records)
  } catch (err) {
    console.error('[GET /api/admin/partners]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (session.user.role !== 'SUPER_ADMIN') {
      return Response.json({ error: 'Forbidden — SUPER_ADMIN only' }, { status: 403 })
    }

    const { shopAId, shopBId } = await req.json()
    if (!shopAId || !shopBId || shopAId === shopBId) {
      return Response.json({ error: 'กรุณาเลือกร้านสองร้านที่ต่างกัน' }, { status: 422 })
    }

    // Verify both shops exist
    const count = await prisma.shop.count({ where: { id: { in: [shopAId, shopBId] } } })
    if (count !== 2) return Response.json({ error: 'ไม่พบร้านที่เลือก' }, { status: 422 })

    // Check existing
    const existing = await prisma.shopPartner.findUnique({
      where: { shopId_partnerId: { shopId: shopAId, partnerId: shopBId } },
    })
    if (existing) return Response.json({ error: 'เป็นพันธมิตรกันอยู่แล้ว' }, { status: 422 })

    // Insert both directions
    await prisma.$transaction([
      prisma.shopPartner.create({ data: { shopId: shopAId, partnerId: shopBId } }),
      prisma.shopPartner.create({ data: { shopId: shopBId, partnerId: shopAId } }),
    ])

    return Response.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/partners]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
