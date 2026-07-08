import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import RegisterForm from './RegisterForm'

export default async function RegisterPage() {
  const session = await auth()
  if (session) redirect('/')

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#f1f5f9',
      padding: '24px 16px',
    }}>
      <RegisterForm />
    </div>
  )
}
