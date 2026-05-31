import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const techs = await prisma.user.findMany({
      where: {
        shopId: session.user.shopId,
        role: { in: ['TECH', 'LEAD_TECH'] },
        isActive: true,
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    })

    return Response.json(techs)
  } catch (err) {
    console.error('[GET /api/users/techs]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
