import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const refCode = String(body.refCode || '').toUpperCase().trim()

  if (!refCode || refCode.length !== 5) {
    return Response.json({ error: 'รหัสร้านต้องมี 5 หลัก' }, { status: 422 })
  }

  const shop = await prisma.shop.findUnique({
    where: { refCode },
    select: { name: true },
  })

  if (!shop) {
    return Response.json({ error: 'ไม่พบรหัสร้านนี้ในระบบ' }, { status: 404 })
  }

  return Response.json({ shopName: shop.name })
}
