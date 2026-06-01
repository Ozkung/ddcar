import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import type { Role } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, shopId } = session.user
  if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const filterShopId = role === 'SUPER_ADMIN'
    ? (req.nextUrl.searchParams.get('shopId') ?? undefined)
    : shopId

  const users = await prisma.user.findMany({
    where: filterShopId ? { shopId: filterShopId } : {},
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  return Response.json(users)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role: currentRole, shopId } = session.user
  if (currentRole !== 'SUPER_ADMIN' && currentRole !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, email, password, role, shopId: targetShopId } = body

  if (!name?.trim() || !email?.trim() || !password || !role) {
    return Response.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 422 })
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password ต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 422 })
  }
  if (role === 'SUPER_ADMIN' && currentRole !== 'SUPER_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // SUPER_ADMIN can create users in any shop; others are locked to their own shop
  const resolvedShopId = (currentRole === 'SUPER_ADMIN' && targetShopId) ? targetShopId : shopId

  const normalizedEmail = email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({
    where: { email_shopId: { email: normalizedEmail, shopId: resolvedShopId } },
  })
  if (existing) {
    return Response.json({ error: 'Email นี้ถูกใช้แล้วในร้านนี้' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: role as Role,
      shopId: resolvedShopId,
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  })

  return Response.json(user, { status: 201 })
}
