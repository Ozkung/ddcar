import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import ReceiptContent from './ReceiptContent'

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const session = await auth()
  const shopId = session?.user?.shopId ?? ''

  const job = await prisma.job.findFirst({
    where: {
      id: params.id,
      OR: [
        { shopId },
        { transfer: { toShopId: shopId, status: 'ACCEPTED' } },
      ],
    },
    include: {
      images: true,
      transfer: {
        include: {
          fromShop: { select: { name: true, refCode: true } },
          toShop:   { select: { name: true, refCode: true } },
        },
      },
    },
  })

  if (!job) notFound()

  return (
    <ReceiptContent
      job={{
        ...job,
        createdAt: job.createdAt.toISOString(),
      }}
      currentShopId={shopId}
    />
  )
}
