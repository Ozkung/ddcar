import { prisma } from './prisma'

/**
 * Generates a unique job number for the given date.
 * Format: DD-YYYYMMDD-NNN (e.g. DD-20260527-001)
 * NNN = (count of jobs already on that date) + 1, zero-padded to 3 digits.
 */
export async function generateJobNo(date: string): Promise<string> {
  const datePart = date.replace(/-/g, '') // "2026-05-27" → "20260527"
  const count = await prisma.job.count({ where: { date } })
  const seq = String(count + 1).padStart(3, '0')
  return `DD-${datePart}-${seq}`
}
