jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

import { generateJobNo } from '@/lib/jobNo'
import { prisma } from '@/lib/prisma'

const mockCount = prisma.job.count as jest.Mock
const mockFindUnique = prisma.job.findUnique as jest.Mock

describe('generateJobNo', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns DD-20260527-001 for the first job on a date', async () => {
    mockCount.mockResolvedValue(0)
    mockFindUnique.mockResolvedValue(null) // jobNo not taken
    const result = await generateJobNo('2026-05-27')
    expect(result).toBe('DD-20260527-001')
    expect(mockCount).toHaveBeenCalledWith({ where: { date: '2026-05-27' } })
  })

  it('returns DD-20260527-006 when 5 jobs already exist on that date', async () => {
    mockCount.mockResolvedValue(5)
    mockFindUnique.mockResolvedValue(null)
    const result = await generateJobNo('2026-05-27')
    expect(result).toBe('DD-20260527-006')
  })

  it('pads sequence to 3 digits for seq < 10', async () => {
    mockCount.mockResolvedValue(2)
    mockFindUnique.mockResolvedValue(null)
    const result = await generateJobNo('2026-01-01')
    expect(result).toBe('DD-20260101-003')
  })

  it('retries when generated jobNo is already taken', async () => {
    mockCount
      .mockResolvedValueOnce(0)  // first attempt: count=0 → DD-xxx-001
      .mockResolvedValueOnce(1)  // retry: count=1 → DD-xxx-002
    mockFindUnique
      .mockResolvedValueOnce({ id: 'existing' }) // DD-xxx-001 is taken
      .mockResolvedValueOnce(null)               // DD-xxx-002 is free
    const result = await generateJobNo('2026-05-27')
    expect(result).toBe('DD-20260527-002')
    expect(mockCount).toHaveBeenCalledTimes(2)
  })
})
