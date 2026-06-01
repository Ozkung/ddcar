import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import IncomingJobsTable from './IncomingJobsTable'

export default async function IncomingJobsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, shopId } = session.user
  if (role === 'TECH') redirect('/')

  const transfers = await prisma.jobTransfer.findMany({
    where: {
      toShopId: shopId,
      status: { in: ['PENDING', 'ACCEPTED'] },
    },
    include: {
      job: {
        select: {
          id: true,
          jobNo: true,
          customerName: true,
          licensePlate: true,
          status: true,
          date: true,
        },
      },
      fromShop: { select: { name: true, refCode: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const canManage = role === 'SUPER_ADMIN' || role === 'SHOP_ADMIN' || role === 'LEAD_TECH'

  // Prisma returns JobTransferStatus (which includes REJECTED), but we only
  // query PENDING/ACCEPTED — cast to the narrower client-side union.
  type ClientTransfer = Parameters<typeof IncomingJobsTable>[0]['transfers'][number]
  const clientTransfers = transfers as unknown as ClientTransfer[]

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <IncomingJobsTable transfers={clientTransfers} canManage={canManage} />
    </div>
  )
}
