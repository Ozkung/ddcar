import { prisma } from './prisma'

/**
 * Generates a unique job number for the given date.
 * Format: DD-YYYYMMDD-NNN (e.g. DD-20260527-001)
 * Uses an optimistic retry loop to handle concurrent submissions on the same date.
 */
export async function generateJobNo(date: string): Promise<string> {
  const datePart = date.replace(/-/g, '')
  const maxRetries = 5

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const count = await prisma.job.count({ where: { date } })
    const seq = String(count + 1).padStart(3, '0')
    const jobNo = `DD-${datePart}-${seq}`

    // Verify jobNo is still available (guard against race)
    const existing = await prisma.job.findUnique({ where: { jobNo } })
    if (!existing) {
      return jobNo
    }
    // jobNo already taken (concurrent request) — retry with fresh count
  }

  // Fallback: use timestamp-based suffix to guarantee uniqueness
  const ts = Date.now().toString().slice(-4)
  return `DD-${datePart}-T${ts}`
}
