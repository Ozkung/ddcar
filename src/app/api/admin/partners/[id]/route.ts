import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'SUPER_ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const record = await prisma.shopPartner.findUnique({ where: { id: params.id } })
    if (!record) return Response.json({ error: 'Not found' }, { status: 404 })

    // Delete both directions
    await prisma.$transaction([
      prisma.shopPartner.delete({ where: { id: record.id } }),
      prisma.shopPartner.deleteMany({
        where: { shopId: record.partnerId, partnerId: record.shopId },
      }),
    ])

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/admin/partners/[id]]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
