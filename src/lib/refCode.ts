import { prisma } from './prisma'

// Charset excludes visually confusing characters: O (oh), 0 (zero), I (eye), 1 (one)
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomRefCode(): string {
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return code
}

export async function generateRefCode(maxRetries = 10): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const code = randomRefCode()
    const existing = await prisma.shop.findUnique({ where: { refCode: code } })
    if (!existing) return code
  }
  throw new Error('Failed to generate unique ref code after max retries')
}
