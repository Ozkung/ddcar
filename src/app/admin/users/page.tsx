import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { UsersTable } from './UsersTable'

export default async function UsersPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { shopId } = session.user
  const users = await prisma.user.findMany({
    where: { shopId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  return <UsersTable users={users} />
}
