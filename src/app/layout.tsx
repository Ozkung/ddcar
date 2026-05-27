import type { Metadata } from 'next'
import { Sarabun } from 'next/font/google'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
import thTH from 'antd/locale/th_TH'
import Link from 'next/link'
import './globals.css'

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ดีดีช่างยนต์',
  description: 'ระบบรับรถเข้าซ่อม',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className={sarabun.className}>
        <AntdRegistry>
          <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'Sarabun, sans-serif' } }}>
            <nav style={{
              background: '#2563eb',
              padding: '0.75rem 1.5rem',
              display: 'flex',
              gap: '1.5rem',
              alignItems: 'center',
            }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>
                🔧 ดีดีช่างยนต์
              </span>
              <Link href="/" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                รับรถเข้าซ่อม
              </Link>
              <Link href="/report" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                รายงาน
              </Link>
            </nav>
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}
