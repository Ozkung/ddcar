import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateRefCode } from '@/lib/refCode'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId } = session.user
  if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const where =
    role === 'SUPER_ADMIN'
      ? {}
      : { OR: [{ id: shopId }, { parentId: shopId }] }

  const shops = await prisma.shop.findMany({
    where,
    include: { _count: { select: { users: true } }, parent: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return Response.json(shops)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId } = session.user
  if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, parentId } = body

  if (!name?.trim()) {
    return Response.json({ error: 'ชื่อร้านจำเป็น' }, { status: 422 })
  }

  // SUPER_ADMIN can create main shops and branches
  // SHOP_ADMIN can only create branches of their own shop
  let resolvedParentId: string | null = null
  if (role === 'SHOP_ADMIN') {
    resolvedParentId = shopId // always their own shop
  } else if (parentId) {
    resolvedParentId = parentId
  }

  const refCode = await generateRefCode()
  const shop = await prisma.shop.create({
    data: { name: name.trim(), refCode, parentId: resolvedParentId },
  })

  return Response.json(shop, { status: 201 })
}
