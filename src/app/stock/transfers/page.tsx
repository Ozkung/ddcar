import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import TransfersTable from './TransfersTable'

export default async function TransfersPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, shopId } = session.user
  if (role === 'TECH') redirect('/')

  const [branchTransfers, partnerTransfers] = await Promise.all([
    prisma.stockTransfer.findMany({
      where: { OR: [{ fromShopId: shopId }, { toShopId: shopId }], type: 'BRANCH' },
      include: {
        fromShop: { select: { name: true } },
        toShop:   { select: { name: true } },
        items:    { include: { stockItem: { select: { name: true, unit: true } } } },
        disputes: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stockTransfer.findMany({
      where: { OR: [{ fromShopId: shopId }, { toShopId: shopId }], type: 'PARTNER_SALE' },
      include: {
        fromShop: { select: { name: true } },
        toShop:   { select: { name: true } },
        items:    { include: { stockItem: { select: { name: true, unit: true } } } },
        disputes: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <TransfersTable
        branchTransfers={branchTransfers}
        partnerTransfers={partnerTransfers}
        currentShopId={shopId}
        canManage={true}
      />
    </div>
  )
}
