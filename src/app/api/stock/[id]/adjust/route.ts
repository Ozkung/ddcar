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

    const body = await req.json()
    const { delta, reason } = body

    const numDelta = Number(delta)

    // validate delta
    if (!Number.isFinite(numDelta) || numDelta === 0) {
      return NextResponse.json({ error: 'delta ต้องเป็นตัวเลขที่ไม่ใช่ 0' }, { status: 422 })
    }
    if (!reason || !VALID_REASONS.includes(String(reason))) {
      return NextResponse.json({ error: `reason ต้องเป็น: ${VALID_REASONS.join(', ')}` }, { status: 422 })
    }

    let updated
    try {
      updated = await prisma.$transaction(async (tx) => {
        const current = await tx.stockItem.findFirst({ where: { id: params.id, shopId } })
        if (!current) throw Object.assign(new Error('Not found'), { status: 404 })
        if (current.quantity + numDelta < 0) {
          throw Object.assign(new Error('จำนวนคงเหลือจะติดลบ'), { status: 422 })
        }
        if (current.quantity + numDelta < current.reserved) {
          throw Object.assign(
            new Error(`ไม่สามารถลดได้ เนื่องจากมีของจอง ${current.reserved} ${current.unit} อยู่`),
            { status: 422 }
          )
        }
        const result = await tx.stockItem.update({
          where: { id: params.id },
          data: { quantity: { increment: numDelta } },
        })
        await tx.stockAdjustLog.create({
          data: { stockItemId: params.id, delta: numDelta, reason: String(reason), userId },
        })
        return result
      })
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e.status === 404) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (e.status === 422) return NextResponse.json({ error: e.message }, { status: 422 })
      throw err
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[POST /api/stock/[id]/adjust]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
