import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId } = session.user
    if (role === 'TECH') return Response.json({ error: 'Forbidden' }, { status: 403 })

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

    return Response.json(transfers)
  } catch (err) {
    console.error('[GET /api/jobs/incoming]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
