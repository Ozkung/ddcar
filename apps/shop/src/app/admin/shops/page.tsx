import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ShopsTable } from './ShopsTable'

export default async function ShopsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, shopId } = session.user
  const where =
    role === 'SUPER_ADMIN'
      ? {}
      : { OR: [{ id: shopId }, { parentId: shopId }] }

  const shops = await prisma.shop.findMany({
    where,
    include: { _count: { select: { users: true } }, parent: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return <ShopsTable shops={shops} role={role} />
}
