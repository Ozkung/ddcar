import { randomRefCode } from '@/lib/refCode'

describe('randomRefCode', () => {
  it('returns a 5-char uppercase alphanumeric string', () => {
    const code = randomRefCode()
    expect(code).toHaveLength(5)
    expect(code).toMatch(/^[A-Z0-9]+$/)
  })

  it('produces different codes on repeated calls', () => {
    const codes = new Set(Array.from({ length: 20 }, randomRefCode))
    expect(codes.size).toBeGreaterThan(1)
  })
})
