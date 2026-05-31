import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const VALID_REASONS = ['รับของ', 'ตัดของหาย', 'ปรับปรุงยอด']

/* ─── POST /api/stock/[id]/adjust ────────────────────────────────────────────── */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, shopId, id: userId } = session.user
    if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const item = await prisma.stockItem.findFirst({ where: { id: params.id, shopId } })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const { delta, reason } = body

    if (delta == null || isNaN(Number(delta)) || Number(delta) === 0) {
      return NextResponse.json({ error: 'delta ต้องเป็นตัวเลขที่ไม่ใช่ 0' }, { status: 422 })
    }
    if (!reason || !VALID_REASONS.includes(String(reason))) {
      return NextResponse.json({ error: `reason ต้องเป็น: ${VALID_REASONS.join(', ')}` }, { status: 422 })
    }

    const numDelta = Number(delta)
    const newQty = item.quantity + numDelta
    if (newQty < 0) {
      return NextResponse.json({ error: 'จำนวนคงเหลือจะติดลบ' }, { status: 422 })
    }

    const [updated] = await prisma.$transaction([
      prisma.stockItem.update({
        where: { id: params.id },
        data: { quantity: { increment: numDelta } },
      }),
      prisma.stockAdjustLog.create({
        data: { stockItemId: params.id, delta: numDelta, reason: String(reason), userId },
      }),
    ])

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[POST /api/stock/[id]/adjust]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
