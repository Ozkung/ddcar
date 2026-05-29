import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ReceiptContent from './ReceiptContent'

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: { images: true },
  })

  if (!job) notFound()

  // Serialize Date → string before passing to client component
  return (
    <ReceiptContent
      job={{
        ...job,
        createdAt: job.createdAt.toISOString(),
      }}
    />
  )
}
