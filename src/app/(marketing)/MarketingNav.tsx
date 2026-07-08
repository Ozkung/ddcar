'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from 'antd'
import { Wrench } from 'lucide-react'

const NAV_LINKS = [
  { href: '/', label: 'หน้าแรก' },
  { href: '/about', label: 'เกี่ยวกับ' },
  { href: '/price', label: 'ราคา' },
  { href: '/contact', label: 'ติดต่อ' },
]

export default function MarketingNav() {
  const pathname = usePathname()

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'white',
      borderBottom: '1px solid #e2e8f0',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '0 24px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#1e293b', fontWeight: 700, fontSize: '1rem' }}>
          <Wrench size={20} color="#2563eb" />
          ดีดีช่างยนต์
        </Link>

        {/* Nav links */}
        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: '0.9rem',
                color: pathname === href ? '#2563eb' : '#475569',
                background: pathname === href ? '#eff6ff' : 'transparent',
                fontWeight: pathname === href ? 600 : 400,
              }}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Link href="/login">
            <Button>เข้าสู่ระบบ</Button>
          </Link>
          <Link href="/register">
            <Button type="primary">สมัครสมาชิก</Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
