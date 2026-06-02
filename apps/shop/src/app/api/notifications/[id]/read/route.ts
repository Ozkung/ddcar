import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId } = session.user

  await prisma.notification.updateMany({
    where: { id: params.id, shopId },
    data: { isRead: true },
  })

  return NextResponse.json({ ok: true })
}
