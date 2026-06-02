import type { Metadata } from 'next'
import { Sarabun } from 'next/font/google'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import Link from 'next/link'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'
import { UserNav } from './UserNav'
import { prisma } from '@/lib/prisma'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'
import { NotificationBell } from '@/components/NotificationBell'
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

export const dynamic = 'force-dynamic'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const user = session?.user

  let pendingTransferCount = 0
  if (user && user.role !== 'TECH') {
    pendingTransferCount = await prisma.jobTransfer.count({
      where: { toShopId: user.shopId, status: 'PENDING' },
    })
  }

  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('ddcar-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark')})()`,
          }}
        />
      </head>
      <body className={sarabun.className}>
        <SessionProvider>
          <AntdRegistry>
            <ThemeProvider>
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
                    ดีดีช่างยนต์
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
                  {(user.role === 'SUPER_ADMIN' || user.role === 'SHOP_ADMIN' || user.role === 'LEAD_TECH') && (
                    <Link href="/jobs/incoming" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', position: 'relative' }}>
                      งานที่รับโอน
                      {pendingTransferCount > 0 && (
                        <span style={{
                          position: 'absolute',
                          top: -8,
                          right: -12,
                          background: '#ef4444',
                          color: 'white',
                          borderRadius: '50%',
                          fontSize: 10,
                          fontWeight: 700,
                          minWidth: 16,
                          height: 16,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 3px',
                        }}>
                          {pendingTransferCount}
                        </span>
                      )}
                    </Link>
                  )}
                  {(user.role === 'SUPER_ADMIN' || user.role === 'SHOP_ADMIN') && (
                    <Link href="/admin/users" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                      จัดการผู้ใช้
                    </Link>
                  )}
                  {(user.role === 'SUPER_ADMIN' || user.role === 'SHOP_ADMIN') && (
                    <Link href="/admin/partners" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                      จัดการพันธมิตร
                    </Link>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ThemeToggle />
                    <NotificationBell />
                    <UserNav name={user.name!} role={user.role} shopName={user.shopName} />
                  </div>
                </nav>
              )}
              {children}
              <footer style={{ textAlign: 'center', padding: '1.5rem', fontSize: 12, color: '#94a3b8' }}>
                <Link href="/privacy" style={{ color: '#94a3b8', marginRight: 16 }}>Privacy Policy</Link>
                <Link href="/terms" style={{ color: '#94a3b8' }}>Terms of Service</Link>
              </footer>
            </ThemeProvider>
          </AntdRegistry>
        </SessionProvider>
      </body>
    </html>
  )
}
