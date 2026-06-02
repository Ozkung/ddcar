import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId } = session.user

  const limit = Math.min(50, Number(req.nextUrl.searchParams.get('limit') ?? '10'))

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({ where: { shopId, isRead: false } }),
  ])

  return NextResponse.json({ items, unreadCount })
}

export async function PATCH(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId } = session.user

  await prisma.notification.updateMany({
    where: { shopId, isRead: false },
    data: { isRead: true },
  })

  return NextResponse.json({ ok: true })
}
