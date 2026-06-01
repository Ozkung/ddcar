import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId } = session.user
    if (role === 'TECH') return Response.json({ error: 'Forbidden' }, { status: 403 })

    if (role === 'SUPER_ADMIN') {
      // All partnerships (both directions - deduped) + all pending
      const all = await prisma.shopPartner.findMany({
        include: {
          shop:    { select: { id: true, name: true, refCode: true } },
          partner: { select: { id: true, name: true, refCode: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      // Deduplicate ACCEPTED (show each pair once)
      const accepted = all.filter(r => r.status === 'ACCEPTED' && r.shopId < r.partnerId)
      const pending  = all.filter(r => r.status === 'PENDING')

      // Also return SUPER_ADMIN's own shop refCode
      const myShop = await prisma.shop.findUnique({ where: { id: shopId }, select: { refCode: true } })

      return Response.json({ myRefCode: myShop?.refCode, accepted, pending })
    }

    // SHOP_ADMIN / LEAD_TECH: own view
    const myShop = await prisma.shop.findUnique({ where: { id: shopId }, select: { refCode: true } })

    const [accepted, incoming, outgoing] = await Promise.all([
      // Partnerships I initiated that are ACCEPTED
      prisma.shopPartner.findMany({
        where: { shopId, status: 'ACCEPTED' },
        include: { partner: { select: { id: true, name: true, refCode: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      // Requests sent TO me that are PENDING
      prisma.shopPartner.findMany({
        where: { partnerId: shopId, status: 'PENDING' },
        include: { shop: { select: { id: true, name: true, refCode: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      // Invites I sent that are still PENDING
      prisma.shopPartner.findMany({
        where: { shopId, status: 'PENDING' },
        include: { partner: { select: { id: true, name: true, refCode: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return Response.json({ myRefCode: myShop?.refCode, accepted, incoming, outgoing })
  } catch (err) {
    console.error('[GET /api/admin/partners]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId } = session.user
    if (role === 'TECH' || role === 'LEAD_TECH') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    // SUPER_ADMIN direct creation: { shopAId, shopBId } → creates ACCEPTED immediately
    if (role === 'SUPER_ADMIN' && body.shopAId && body.shopBId) {
      const { shopAId, shopBId } = body
      if (shopAId === shopBId) {
        return Response.json({ error: 'กรุณาเลือกร้านสองร้านที่ต่างกัน' }, { status: 422 })
      }
      const count = await prisma.shop.count({ where: { id: { in: [shopAId, shopBId] } } })
      if (count !== 2) return Response.json({ error: 'ไม่พบร้านที่เลือก' }, { status: 422 })

      const existing = await prisma.shopPartner.findFirst({
        where: {
          OR: [
            { shopId: shopAId, partnerId: shopBId },
            { shopId: shopBId, partnerId: shopAId },
          ],
        },
      })
      if (existing) return Response.json({ error: 'เป็นพันธมิตรกันอยู่แล้ว' }, { status: 422 })

      await prisma.$transaction([
        prisma.shopPartner.create({ data: { shopId: shopAId, partnerId: shopBId, status: 'ACCEPTED' } }),
        prisma.shopPartner.create({ data: { shopId: shopBId, partnerId: shopAId, status: 'ACCEPTED' } }),
      ])
      return Response.json({ ok: true }, { status: 201 })
    }

    // Standard invite flow: { refCode } → creates PENDING request
    const { refCode } = body
    if (!refCode?.trim()) {
      return Response.json({ error: 'กรุณาระบุ Ref Code ของร้านที่ต้องการเป็นพันธมิตร' }, { status: 422 })
    }

    const targetShop = await prisma.shop.findUnique({
      where: { refCode: refCode.trim().toUpperCase() },
      select: { id: true, name: true },
    })
    if (!targetShop) return Response.json({ error: 'ไม่พบร้านที่มี Ref Code นี้' }, { status: 404 })
    if (targetShop.id === shopId) {
      return Response.json({ error: 'ไม่สามารถเพิ่มร้านตัวเองเป็นพันธมิตร' }, { status: 422 })
    }

    // Check no existing relationship (either direction)
    const existing = await prisma.shopPartner.findFirst({
      where: {
        OR: [
          { shopId, partnerId: targetShop.id },
          { shopId: targetShop.id, partnerId: shopId },
        ],
      },
    })
    if (existing?.status === 'ACCEPTED') {
      return Response.json({ error: 'เป็นพันธมิตรกันอยู่แล้ว' }, { status: 422 })
    }
    if (existing?.status === 'PENDING') {
      return Response.json({ error: 'มีคำขอรออยู่แล้ว' }, { status: 422 })
    }

    await prisma.shopPartner.create({
      data: { shopId, partnerId: targetShop.id, status: 'PENDING' },
    })

    return Response.json({ ok: true, targetName: targetShop.name }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e.code === 'P2002') {
      return Response.json({ error: 'มีคำขอหรือความสัมพันธ์นี้อยู่แล้ว' }, { status: 422 })
    }
    console.error('[POST /api/admin/partners]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
