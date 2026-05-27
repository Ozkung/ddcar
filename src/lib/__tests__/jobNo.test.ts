jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      count: jest.fn(),
    },
  },
}))

import { generateJobNo } from '@/lib/jobNo'
import { prisma } from '@/lib/prisma'

const mockCount = prisma.job.count as jest.Mock

describe('generateJobNo', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns DD-20260527-001 for the first job on a date', async () => {
    mockCount.mockResolvedValue(0)
    const result = await generateJobNo('2026-05-27')
    expect(result).toBe('DD-20260527-001')
    expect(mockCount).toHaveBeenCalledWith({ where: { date: '2026-05-27' } })
  })

  it('returns DD-20260527-006 when 5 jobs already exist on that date', async () => {
    mockCount.mockResolvedValue(5)
    const result = await generateJobNo('2026-05-27')
    expect(result).toBe('DD-20260527-006')
  })

  it('pads sequence to 3 digits for seq < 10', async () => {
    mockCount.mockResolvedValue(2)
    const result = await generateJobNo('2026-01-01')
    expect(result).toBe('DD-20260101-003')
  })

  it('strips hyphens from the date part', async () => {
    mockCount.mockResolvedValue(0)
    const result = await generateJobNo('2026-12-31')
    expect(result).toMatch(/^DD-20261231-\d{3}$/)
  })
})
