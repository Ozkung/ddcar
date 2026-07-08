import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import MarketingNav from './MarketingNav'

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (session) redirect('/dashboard')

  return (
    <>
      <MarketingNav />
      {children}
      <footer style={{
        background: '#1e293b',
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        padding: '24px 16px',
        fontSize: 13,
      }}>
        <div style={{ marginBottom: 8 }}>
          <a href="/privacy" style={{ color: 'rgba(255,255,255,0.5)', marginRight: 20 }}>Privacy Policy</a>
          <a href="/terms" style={{ color: 'rgba(255,255,255,0.5)' }}>Terms of Service</a>
        </div>
        © {new Date().getFullYear()} ดีดีช่างยนต์ · สงวนลิขสิทธิ์
      </footer>
    </>
  )
}
