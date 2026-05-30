import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Table, Tag, Button, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

const { Title } = Typography

export default async function ShopsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, shopId } = session.user
  const where =
    role === 'SUPER_ADMIN'
      ? {}
      : { OR: [{ id: shopId }, { parentId: shopId }] }

  const shops = await prisma.shop.findMany({
    where,
    include: { _count: { select: { users: true } }, parent: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const columns = [
    {
      title: 'ชื่อร้าน',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
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
      render: (_: any, record: any) => record.parent?.name || <span style={{ color: '#94a3b8' }}>ร้านหลัก</span>,
    },
    { title: 'จำนวน User', key: 'users', render: (_: any, record: any) => record._count.users },
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
