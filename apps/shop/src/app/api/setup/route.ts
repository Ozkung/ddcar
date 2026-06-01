import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generateRefCode } from '@/lib/refCode'

export async function POST(req: NextRequest) {
  // Block if already set up
  const count = await prisma.user.count()
  if (count > 0) {
    return Response.json({ error: 'Setup already completed' }, { status: 403 })
  }

  const body = await req.json()
  const { shopName, adminName, adminEmail, adminPassword } = body

  if (!shopName?.trim() || !adminName?.trim() || !adminEmail?.trim() || !adminPassword) {
    return Response.json({ error: 'Missing required fields' }, { status: 422 })
  }

  if (adminPassword.length < 8) {
    return Response.json({ error: 'Password ต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 422 })
  }

  const refCode = await generateRefCode()
  const hashedPassword = await bcrypt.hash(adminPassword, 12)

  // Create shop + super admin in one transaction
  // Also migrate any existing jobs (shopId = null) to this shop
  const result = await prisma.$transaction(async (tx) => {
    const shop = await tx.shop.create({
      data: {
        refCode,
        name: shopName.trim(),
        users: {
          create: {
            email: adminEmail.trim().toLowerCase(),
            password: hashedPassword,
            name: adminName.trim(),
            role: 'SUPER_ADMIN',
            isActive: true,
          },
        },
      },
      include: { users: true },
    })

    // Assign pre-existing jobs (before auth was added) to this shop
    await tx.job.updateMany({
      where: { shopId: null },
      data: { shopId: shop.id, createdBy: shop.users[0].id },
    })

    return shop
  })

  return Response.json(
    { shopName: result.name, refCode: result.refCode },
    { status: 201 }
  )
}
