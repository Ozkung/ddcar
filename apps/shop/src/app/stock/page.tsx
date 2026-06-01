import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import StockTable from './StockTable'

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
      <StockTable items={data} canEdit={canEdit} />
    </div>
  )
}
