import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import StockTable from './StockTable'

const { Title } = Typography

export default async function StockPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, shopId } = session.user
  if (role === 'TECH') redirect('/')

  const items = await prisma.stockItem.findMany({
    where: { shopId },
    orderBy: { name: 'asc' },
  })

  const data = items.map(i => ({ ...i, availableQty: i.quantity - i.reserved }))
  const canEdit = role === 'SUPER_ADMIN' || role === 'SHOP_ADMIN'

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>คลังอะไหล่</Title>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && (
            <Link href="/stock/transfers/new">
              <Button>โอนอะไหล่</Button>
            </Link>
          )}
          <Link href="/stock/transfers">
            <Button>ประวัติการโอน</Button>
          </Link>
          {canEdit && (
            <Link href="/stock/new">
              <Button type="primary" icon={<PlusOutlined />}>เพิ่มอะไหล่</Button>
            </Link>
          )}
        </div>
      </div>
      <StockTable items={data} canEdit={canEdit} />
    </div>
  )
}
