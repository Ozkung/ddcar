import { generateRefCode } from '@/app/api/auth/register/route'

describe('generateRefCode', () => {
  it('returns a 5-char uppercase alphanumeric string', () => {
    const code = generateRefCode()
    expect(code).toHaveLength(5)
    expect(code).toMatch(/^[A-Z0-9]+$/)
  })

  it('produces different codes on repeated calls', () => {
    const codes = new Set(Array.from({ length: 20 }, generateRefCode))
    expect(codes.size).toBeGreaterThan(1)
  })
})
