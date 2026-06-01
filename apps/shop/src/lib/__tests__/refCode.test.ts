jest.mock('@/lib/prisma', () => ({
  prisma: {
    shop: {
      findUnique: jest.fn(),
    },
  },
}))

import { generateRefCode } from '@/lib/refCode'
import { prisma } from '@/lib/prisma'

const mockFindUnique = prisma.shop.findUnique as jest.Mock

describe('generateRefCode', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns a 5-character code with valid charset', async () => {
    mockFindUnique.mockResolvedValue(null)
    const code = await generateRefCode()
    expect(code).toHaveLength(5)
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/)
  })

  it('retries when generated code is already taken', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null)
    const code = await generateRefCode()
    expect(code).toHaveLength(5)
    expect(mockFindUnique).toHaveBeenCalledTimes(2)
  })

  it('throws after max retries are exhausted', async () => {
    mockFindUnique.mockResolvedValue({ id: 'existing' })
    await expect(generateRefCode(3)).rejects.toThrow(
      'Failed to generate unique ref code'
    )
  })

  it('only uses characters from the safe charset (no O, 0, I, 1)', async () => {
    mockFindUnique.mockResolvedValue(null)
    for (let i = 0; i < 20; i++) {
      const code = await generateRefCode()
      expect(code).not.toMatch(/[O0I1]/)
    }
  })
})
