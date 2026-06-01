'use client'

import Link from 'next/link'
import { Table, Tag, Button, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { Role } from '@prisma/client'

const { Title } = Typography

interface Shop {
  id: string
  name: string
  refCode: string
  parentId: string | null
  parent: { name: string } | null
  _count: { users: number }
}

interface Props {
  shops: Shop[]
  role: Role
}

export function ShopsTable({ shops, role }: Props) {
  const columns = [
    {
      title: 'ชื่อร้าน',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Shop) => (
        <span>
          {name}
          {record.parentId && <Tag color="blue" style={{ marginLeft: 8 }}>สาขา</Tag>}
        </span>
      ),
    },
    {
      title: 'Ref Code',
      dataIndex: 'refCode',
      key: 'refCode',
      render: (code: string) => (
        <code style={{ fontFamily: 'monospace', letterSpacing: 3, fontSize: 14 }}>{code}</code>
      ),
    },
    {
      title: 'สังกัด',
      key: 'parent',
      render: (_: unknown, record: Shop) =>
        record.parent?.name || <span style={{ color: '#94a3b8' }}>ร้านหลัก</span>,
    },
    {
      title: 'จำนวน User',
      key: 'users',
      render: (_: unknown, record: Shop) => record._count.users,
    },
  ]

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>ร้านและสาขา</Title>
        <Link href="/admin/shops/new">
          <Button type="primary" icon={<PlusOutlined />}>
            {role === 'SHOP_ADMIN' ? 'สร้างสาขา' : 'สร้างร้านใหม่'}
          </Button>
        </Link>
      </div>
      <Table dataSource={shops} columns={columns} rowKey="id" pagination={false} />
    </div>
  )
}
