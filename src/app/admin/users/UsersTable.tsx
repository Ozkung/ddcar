'use client'

import Link from 'next/link'
import { Table, Tag, Button, Typography, Space } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { Role } from '@prisma/client'

const { Title } = Typography

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  SHOP_ADMIN:  'Shop Admin',
  LEAD_TECH:   'หัวหน้าช่าง',
  TECH:        'ช่าง',
}

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: 'red',
  SHOP_ADMIN:  'orange',
  LEAD_TECH:   'blue',
  TECH:        'default',
}

interface User {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
}

interface Props {
  users: User[]
}

const columns = [
  { title: 'ชื่อ', dataIndex: 'name', key: 'name' },
  { title: 'Email', dataIndex: 'email', key: 'email' },
  {
    title: 'Role',
    dataIndex: 'role',
    key: 'role',
    render: (role: Role) => (
      <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
    ),
  },
  {
    title: 'สถานะ',
    dataIndex: 'isActive',
    key: 'isActive',
    render: (active: boolean) => (
      <Tag color={active ? 'green' : 'default'}>{active ? 'ใช้งาน' : 'ปิดใช้งาน'}</Tag>
    ),
  },
  {
    title: '',
    key: 'actions',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: (_: any, record: User) => (
      <Link href={`/admin/users/${record.id}/edit`}>
        <Button size="small" icon={<EditOutlined />}>แก้ไข</Button>
      </Link>
    ),
  },
]

export function UsersTable({ users }: Props) {
  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>จัดการผู้ใช้งาน</Title>
        <Space>
          <Link href="/admin/shops">
            <Button>ร้านและสาขา</Button>
          </Link>
          <Link href="/admin/users/new">
            <Button type="primary" icon={<PlusOutlined />}>เพิ่มผู้ใช้</Button>
          </Link>
        </Space>
      </div>
      <Table dataSource={users} columns={columns} rowKey="id" pagination={false} />
    </div>
  )
}
