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
          refCode: string
          email: string
          password: string
        }
        if (!refCode || !email || !password) return null

        const shop = await prisma.shop.findUnique({
          where: { refCode: refCode.toUpperCase() },
        })
        if (!shop) return null

        const user = await prisma.user.findUnique({
          where: { email_shopId: { email, shopId: shop.id } },
        })
        if (!user || !user.isActive) return null

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
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
})
