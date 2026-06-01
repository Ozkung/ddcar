import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import EditForm from './EditForm'

export default async function EditPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { shopId } = session.user

  // Check if this is a destination-shop view
  const transfer = await prisma.jobTransfer.findFirst({
    where: { jobId: params.id, toShopId: shopId, status: 'ACCEPTED' },
    include: { fromShop: { select: { name: true } } },
  })

  const isDestinationShop = !!transfer
  const fromShopName = transfer?.fromShop.name ?? ''

  // Verify access: must be owner OR destination shop
  if (!isDestinationShop) {
    const job = await prisma.job.findFirst({
      where: { id: params.id, shopId },
      select: { id: true },
    })
    if (!job) notFound()
  }

  return <EditForm isDestinationShop={isDestinationShop} fromShopName={fromShopName} />
}
