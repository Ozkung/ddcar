import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PartnersTable from './PartnersTable'

export default async function PartnersPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, shopId } = session.user
  if (role === 'TECH') redirect('/')

  const myShop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { refCode: true, name: true },
  })

  if (role === 'SUPER_ADMIN') {
    const [allRecords, shops] = await Promise.all([
      prisma.shopPartner.findMany({
        include: {
          shop:    { select: { id: true, name: true, refCode: true } },
          partner: { select: { id: true, name: true, refCode: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.shop.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ])

    const accepted = allRecords.filter(r => r.status === 'ACCEPTED' && r.shopId < r.partnerId)
    const pending  = allRecords.filter(r => r.status === 'PENDING')

    return (
      <PartnersTable
        role="SUPER_ADMIN"
        myRefCode={myShop?.refCode ?? ''}
        accepted={accepted}
        pending={pending}
        shops={shops}
      />
    )
  }

  // SHOP_ADMIN / LEAD_TECH
  const [acceptedRaw, incomingRaw, outgoingRaw] = await Promise.all([
    prisma.shopPartner.findMany({
      where: { shopId, status: 'ACCEPTED' },
      include: { partner: { select: { id: true, name: true, refCode: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.shopPartner.findMany({
      where: { partnerId: shopId, status: 'PENDING' },
      include: { shop: { select: { id: true, name: true, refCode: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.shopPartner.findMany({
      where: { shopId, status: 'PENDING' },
      include: { partner: { select: { id: true, name: true, refCode: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <PartnersTable
      role={role}
      myRefCode={myShop?.refCode ?? ''}
      accepted={acceptedRaw}
      incoming={incomingRaw}
      outgoing={outgoingRaw}
    />
  )
}
