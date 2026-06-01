import type { DefaultSession } from 'next-auth'
import type { Role } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
      shopId: string
      shopName: string
    } & DefaultSession['user']
  }

  interface User {
    role: Role
    shopId: string
    shopName: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
    shopId: string
    shopName: string
  }
}
