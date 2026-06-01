import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { UsersTable } from './UsersTable'

export default async function UsersPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, shopId } = session.user
  const isSuperAdmin = role === 'SUPER_ADMIN'

  const users = await prisma.user.findMany({
    where: isSuperAdmin ? {} : { shopId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      shop: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return <UsersTable users={users} isSuperAdmin={isSuperAdmin} />
}
