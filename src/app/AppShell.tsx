'use client'

import { useState, useEffect } from 'react'
import { Layout, Menu, Badge, Tooltip, ConfigProvider } from 'antd'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CarOutlined, FileTextOutlined, BarChartOutlined,
  AppstoreOutlined, SwapOutlined, TeamOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons'
import { Wrench } from 'lucide-react'
import { UserNav } from './UserNav'
import type { Role } from '@prisma/client'

interface Props {
  user: { name: string; role: Role; shopId: string; shopName: string }
  pendingTransferCount: number
  children: React.ReactNode
}

const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'SHOP_ADMIN', 'LEAD_TECH']
const SUPER_ROLES: Role[] = ['SUPER_ADMIN', 'SHOP_ADMIN']

export default function AppShell({ user, pendingTransferCount, children }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  // Collapse by default on mobile
  useEffect(() => {
    if (window.innerWidth < 768) setCollapsed(true)
  }, [])

  const navItems = [
    {
      key: '/',
      icon: <CarOutlined />,
      label: <Link href="/">รับรถเข้าซ่อม</Link>,
    },
    {
      key: '/report',
      icon: <FileTextOutlined />,
      label: <Link href="/report">รายงาน</Link>,
    },
    ...(ADMIN_ROLES.includes(user.role) ? [
      {
        key: '/analytics',
        icon: <BarChartOutlined />,
        label: <Link href="/analytics">วิเคราะห์ข้อมูล</Link>,
      },
      {
        key: '/stock',
        icon: <AppstoreOutlined />,
        label: <Link href="/stock">คลังอะไหล่</Link>,
      },
      {
        key: '/jobs/incoming',
        icon: <SwapOutlined />,
        label: (
          <Link href="/jobs/incoming">
            งานที่รับโอน{' '}
            {pendingTransferCount > 0 && (
              <Badge count={pendingTransferCount} size="small" style={{ marginLeft: 4 }} />
            )}
          </Link>
        ),
      },
    ] : []),
    ...(SUPER_ROLES.includes(user.role) ? [
      {
        key: '/admin/users',
        icon: <TeamOutlined />,
        label: <Link href="/admin/users">จัดการผู้ใช้</Link>,
      },
    ] : []),
  ]

  // Match active key: exact for '/', prefix for others
  const selectedKey = navItems.find(item =>
    item.key === '/' ? pathname === '/' : pathname.startsWith(item.key)
  )?.key ?? ''

  const siderWidth = 220
  const collapsedWidth = 64

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <Layout.Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={siderWidth}
        collapsedWidth={collapsedWidth}
        style={{
          background: '#1e293b',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 20px',
          color: 'white',
          fontWeight: 700,
          fontSize: '1rem',
          gap: 8,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <Wrench size={18} />
          {!collapsed && <span>ดีดีช่างยนต์</span>}
        </div>

        {/* Nav menu */}
        <ConfigProvider theme={{ components: { Menu: { darkItemSelectedBg: 'rgba(37,99,235,0.2)', darkItemSelectedColor: '#2563eb' } } }}>
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[selectedKey]}
            style={{ background: 'transparent', border: 'none', flex: 1, marginTop: 8 }}
            items={navItems}
          />
        </ConfigProvider>

        {/* Footer links */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: collapsed ? '12px 0' : '12px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {collapsed ? (
            <>
              <Tooltip title="Privacy Policy" placement="right">
                <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', display: 'block' }}>P</Link>
              </Tooltip>
              <Tooltip title="Terms of Service" placement="right">
                <Link href="/terms" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', display: 'block' }}>T</Link>
              </Tooltip>
            </>
          ) : (
            <>
              <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Privacy Policy</Link>
              <Link href="/terms" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Terms of Service</Link>
            </>
          )}
        </div>
      </Layout.Sider>

      {/* Main area */}
      <Layout style={{
        marginLeft: collapsed ? collapsedWidth : siderWidth,
        transition: 'margin-left 0.2s',
      }}>
        {/* Topbar */}
        <Layout.Header style={{
          background: 'white',
          padding: '0 16px',
          height: 56,
          lineHeight: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', color: '#374151' }}
          >
            {collapsed ? <MenuUnfoldOutlined style={{ fontSize: 18 }} /> : <MenuFoldOutlined style={{ fontSize: 18 }} />}
          </button>
          <UserNav name={user.name} role={user.role} shopName={user.shopName} />
        </Layout.Header>

        {/* Page content */}
        <Layout.Content>
          {children}
        </Layout.Content>

      </Layout>
    </Layout>
  )
}
