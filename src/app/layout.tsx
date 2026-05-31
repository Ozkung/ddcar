import type { Metadata } from 'next'
import { Sarabun } from 'next/font/google'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
import thTH from 'antd/locale/th_TH'
import Link from 'next/link'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'
import { UserNav } from './UserNav'
import './globals.css'

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ดีดีช่างยนต์',
  description: 'ระบบจัดการงานซ่อมรถยนต์',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'DDReport' },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  other: { 'mobile-web-app-capable': 'yes' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const user = session?.user

  return (
    <html lang="th">
      <body className={sarabun.className}>
        <SessionProvider>
          <AntdRegistry>
            <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'Sarabun, sans-serif' } }}>
              {user && (
                <nav
                  style={{
                    background: '#2563eb',
                    padding: '0.75rem 1.5rem',
                    display: 'flex',
                    gap: '1.5rem',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>
                    🔧 ดีดีช่างยนต์
                  </span>
                  <Link href="/" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                    รับรถเข้าซ่อม
                  </Link>
                  <Link href="/report" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                    รายงาน
                  </Link>
                  {(user.role === 'SUPER_ADMIN' || user.role === 'SHOP_ADMIN' || user.role === 'LEAD_TECH') && (
                    <Link href="/analytics" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                      วิเคราะห์ข้อมูล
                    </Link>
                  )}
                  {(user.role === 'SUPER_ADMIN' || user.role === 'SHOP_ADMIN' || user.role === 'LEAD_TECH') && (
                    <Link href="/stock" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                      คลังอะไหล่
                    </Link>
                  )}
                  {(user.role === 'SUPER_ADMIN' || user.role === 'SHOP_ADMIN') && (
                    <Link href="/admin/users" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                      จัดการผู้ใช้
                    </Link>
                  )}
                  <div style={{ marginLeft: 'auto' }}>
                    <UserNav name={user.name!} role={user.role} shopName={user.shopName} />
                  </div>
                </nav>
              )}
              {children}
            </ConfigProvider>
          </AntdRegistry>
        </SessionProvider>
      </body>
    </html>
  )
}
