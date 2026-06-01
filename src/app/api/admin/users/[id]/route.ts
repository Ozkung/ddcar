import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import type { Role } from '@prisma/client'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role: currentRole, shopId } = session.user
  if (currentRole !== 'SUPER_ADMIN' && currentRole !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const scopeFilter = currentRole === 'SUPER_ADMIN' ? { id: params.id } : { id: params.id, shopId }
  const target = await prisma.user.findFirst({ where: scopeFilter })
  if (!target) return Response.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 })

  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}

  if ('name' in body) data.name = String(body.name).trim()
  if ('role' in body) {
    if (body.role === 'SUPER_ADMIN' && currentRole !== 'SUPER_ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    data.role = body.role as Role
  }
  if ('isActive' in body) data.isActive = Boolean(body.isActive)
  if ('password' in body && body.password) {
    if (String(body.password).length < 8) {
      return Response.json({ error: 'Password ต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 422 })
    }
    data.password = await bcrypt.hash(body.password, 12)
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: 'ไม่มีข้อมูลให้อัพเดท' }, { status: 422 })
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  })

  return Response.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role: currentRole, shopId, id: currentUserId } = session.user
  if (currentRole !== 'SUPER_ADMIN' && currentRole !== 'SHOP_ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (params.id === currentUserId) {
    return Response.json({ error: 'ไม่สามารถลบตัวเองได้' }, { status: 400 })
  }

  const scopeFilter = currentRole === 'SUPER_ADMIN' ? { id: params.id } : { id: params.id, shopId }
  const target = await prisma.user.findFirst({ where: scopeFilter })
  if (!target) return Response.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 })

  await prisma.user.delete({ where: { id: params.id } })
  return Response.json({ ok: true })
}
