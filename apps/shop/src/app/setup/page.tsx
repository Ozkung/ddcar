import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SetupForm from './SetupForm'

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const count = await prisma.user.count()
  if (count > 0) redirect('/login')

  return <SetupForm />
}
