import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import type { Role } from '@prisma/client'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        refCode: {},
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const { refCode, email, password } = credentials as {
          refCode?: string
          email: string
          password: string
        }
        if (!email || !password) return null

        const normalizedEmail = email.trim().toLowerCase()

        if (!refCode || refCode.trim() === '') {
          // Admin path: find by email only, must be SUPER_ADMIN or SHOP_ADMIN
          const user = await prisma.user.findFirst({
            where: {
              email: normalizedEmail,
              role: { in: ['SUPER_ADMIN', 'SHOP_ADMIN'] },
              isActive: true,
            },
            include: { shop: true },
          })
          if (!user) return null
          const valid = await bcrypt.compare(password, user.password)
          if (!valid) return null
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            shopId: user.shopId,
            shopName: user.shop?.name ?? '',
          }
        } else {
          // Staff path: find by refCode + email, must be LEAD_TECH or TECH
          const shop = await prisma.shop.findUnique({
            where: { refCode: refCode.trim().toUpperCase() },
          })
          if (!shop) return null
          const user = await prisma.user.findUnique({
            where: { email_shopId: { email: normalizedEmail, shopId: shop.id } },
          })
          if (!user || !user.isActive) return null
          if (!(['LEAD_TECH', 'TECH'] as Role[]).includes(user.role)) return null
          const valid = await bcrypt.compare(password, user.password)
          if (!valid) return null
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            shopId: user.shopId,
            shopName: shop.name,
          }
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id       = user.id!
        token.role     = (user as any).role as Role
        token.shopId   = (user as any).shopId as string
        token.shopName = (user as any).shopName as string
      }
      return token
    },
    session({ session, token }) {
      session.user.id       = token.id as string
      session.user.role     = token.role as Role
      session.user.shopId   = token.shopId as string
      session.user.shopName = token.shopName as string
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
})
