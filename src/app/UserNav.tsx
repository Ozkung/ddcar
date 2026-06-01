'use client'

import { signOut } from 'next-auth/react'
import { Button, Dropdown } from 'antd'
import { UserOutlined, LogoutOutlined } from '@ant-design/icons'
import type { Role } from '@prisma/client'

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  SHOP_ADMIN:  'Shop Admin',
  LEAD_TECH:   'หัวหน้าช่าง',
  TECH:        'ช่าง',
}

interface Props {
  name: string
  role: Role
  shopName: string
}

export function UserNav({ name, role, shopName }: Props) {
  return (
    <Dropdown
      menu={{
        items: [
          {
            key: 'info',
            label: (
              <div style={{ padding: '4px 0' }}>
                <div style={{ fontWeight: 600 }}>{name}</div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>{shopName}</div>
                <div style={{ color: '#2563eb', fontSize: 12 }}>{ROLE_LABELS[role]}</div>
              </div>
            ),
            disabled: true,
          },
          { type: 'divider' },
          {
            key: 'logout',
            label: 'ออกจากระบบ',
            icon: <LogoutOutlined />,
            danger: true,
            onClick: () => signOut({ callbackUrl: '/login' }),
          },
        ],
      }}
    >
      <Button
        type="text"
        icon={<UserOutlined />}
        style={{ color: 'rgba(255,255,255,0.85)' }}
      >
        {name}
      </Button>
    </Dropdown>
  )
}
