import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRefCode(): string {
  return Array.from({ length: 5 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
}

async function uniqueRefCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateRefCode()
    const exists = await prisma.shop.findUnique({ where: { refCode: code } })
    if (!exists) return code
  }
  throw new Error('Could not generate unique refCode')
}

export async function POST(req: Request) {
  try {
    const { firstName, lastName, shopName, email, password, phone, birthDate } = await req.json()

    if (!firstName || !lastName || !shopName || !email || !password || !phone || !birthDate) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
    }

    const normalizedEmail = (email as string).trim().toLowerCase()

    const existing = await prisma.user.findFirst({ where: { email: normalizedEmail, role: { in: ['SUPER_ADMIN', 'SHOP_ADMIN'] } } })
    if (existing) {
      return NextResponse.json({ error: 'Email นี้ถูกใช้งานแล้ว' }, { status: 409 })
    }

    const refCode = await uniqueRefCode()
    const hashedPassword = await bcrypt.hash(password as string, 10)

    await prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: { refCode, name: shopName as string },
      })
      await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          name: `${firstName} ${lastName}`.trim(),
          role: 'SHOP_ADMIN',
          shopId: shop.id,
          phone: phone as string,
          birthDate: new Date(birthDate as string),
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[register]', err)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 })
  }
}
