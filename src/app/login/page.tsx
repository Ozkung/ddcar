import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect('/')

  const count = await prisma.user.count()
  if (count === 0) redirect('/setup')

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f1f5f9',
      }}
    >
      <LoginForm />
    </div>
  )
}
