import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
import thTH from 'antd/locale/th_TH'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import AppShell from './AppShell'
import './globals.css'

const sarabun = localFont({
  src: [
    { path: '../../public/fonts/sarabun-400-thai.woff2',      weight: '400', style: 'normal' },
    { path: '../../public/fonts/sarabun-400-latin.woff2',     weight: '400', style: 'normal' },
    { path: '../../public/fonts/sarabun-400-latin-ext.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/sarabun-400-vietnamese.woff2',weight: '400', style: 'normal' },
    { path: '../../public/fonts/sarabun-600-thai.woff2',      weight: '600', style: 'normal' },
    { path: '../../public/fonts/sarabun-600-latin.woff2',     weight: '600', style: 'normal' },
    { path: '../../public/fonts/sarabun-600-latin-ext.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/sarabun-600-vietnamese.woff2',weight: '600', style: 'normal' },
    { path: '../../public/fonts/sarabun-700-thai.woff2',      weight: '700', style: 'normal' },
    { path: '../../public/fonts/sarabun-700-latin.woff2',     weight: '700', style: 'normal' },
    { path: '../../public/fonts/sarabun-700-latin-ext.woff2', weight: '700', style: 'normal' },
    { path: '../../public/fonts/sarabun-700-vietnamese.woff2',weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-sarabun',
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

  let pendingTransferCount = 0
  if (user && user.role !== 'TECH') {
    pendingTransferCount = await prisma.jobTransfer.count({
      where: { toShopId: user.shopId, status: 'PENDING' },
    })
  }

  return (
    <html lang="th">
      <body className={sarabun.className}>
        <SessionProvider>
          <AntdRegistry>
            <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'Sarabun, sans-serif' } }}>
              {user ? (
                <AppShell
                  user={{ name: user.name!, role: user.role, shopId: user.shopId, shopName: user.shopName }}
                  pendingTransferCount={pendingTransferCount}
                >
                  {children}
                </AppShell>
              ) : (
                <>
                  {children}
                  <footer style={{ textAlign: 'center', padding: '1.5rem', fontSize: 12, color: '#94a3b8' }}>
                    <a href="/privacy" style={{ color: '#94a3b8', marginRight: 16 }}>Privacy Policy</a>
                    <a href="/terms" style={{ color: '#94a3b8' }}>Terms of Service</a>
                  </footer>
                </>
              )}
            </ConfigProvider>
          </AntdRegistry>
        </SessionProvider>
      </body>
    </html>
  )
}
