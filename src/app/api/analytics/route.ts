import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const STATUSES  = ['ลูกค้าอนุมัติซ่อมแล้ว', 'ซ่อมเสร็จเรียบร้อยแล้ว', 'ส่งมอบและเก็บเงินแล้ว']
const SYMPTOMS  = ['ระบบเครื่องยนต์', 'ระบบส่งกำลัง', 'ระบบช่วงล่าง', 'ระบบปรับอากาศ', 'ระบบเบรค']
const DAYS_TH   = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์']

function getCluster(visits: number, totalSpend: number, recencyDays: number): string {
  if (visits >= 4 || (visits >= 2 && totalSpend >= 10000)) return 'VIP'
  if (visits >= 2 && recencyDays <= 365)                   return 'ประจำ'
  if (visits === 1 && recencyDays <= 90)                   return 'ใหม่'
  return 'เงียบหาย'
}

export async function GET() {
  try {
    const now = new Date()
    const todayStr     = now.toISOString().slice(0, 10)        // YYYY-MM-DD
    const thisMonthStr = todayStr.slice(0, 7)                   // YYYY-MM
    const thisYearStr  = todayStr.slice(0, 4)                   // YYYY

    const allJobs = await prisma.job.findMany({
      select: {
        date: true, customerName: true, phone: true,
        licensePlate: true, symptoms: true,
        totalPrice: true, status: true,
      },
      orderBy: { date: 'asc' },
    })

    /* ── KPIs ─────────────────────────────────────────────────────────────── */
    const revenueToday      = allJobs.filter(j => j.date === todayStr)
                                     .reduce((s, j) => s + j.totalPrice, 0)
    const revenueThisMonth  = allJobs.filter(j => j.date.startsWith(thisMonthStr))
                                     .reduce((s, j) => s + j.totalPrice, 0)
    const revenueThisYear   = allJobs.filter(j => j.date.startsWith(thisYearStr))
                                     .reduce((s, j) => s + j.totalPrice, 0)
    const totalRevenue      = allJobs.reduce((s, j) => s + j.totalPrice, 0)
    const avgJobValue       = allJobs.length > 0 ? Math.round(totalRevenue / allJobs.length) : 0
    const pendingJobs       = allJobs.filter(j => j.status !== 'ส่งมอบและเก็บเงินแล้ว').length

    /* ── Revenue by month (last 12 months) ───────────────────────────────── */
    const monthMap: Record<string, { revenue: number; jobs: number }> = {}
    for (let i = 11; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap[key] = { revenue: 0, jobs: 0 }
    }
    allJobs.forEach(j => {
      const key = j.date.slice(0, 7)
      if (key in monthMap) { monthMap[key].revenue += j.totalPrice; monthMap[key].jobs++ }
    })
    const revenueByMonth = Object.entries(monthMap).map(([m, v]) => ({
      month: m.slice(5) + '/' + m.slice(2, 4),
      revenue: Math.round(v.revenue),
      jobs: v.jobs,
    }))

    /* ── Status distribution ──────────────────────────────────────────────── */
    const statusCount: Record<string, number> = {}
    STATUSES.forEach(s => { statusCount[s] = 0 })
    allJobs.forEach(j => { statusCount[j.status] = (statusCount[j.status] ?? 0) + 1 })
    const statusDist = Object.entries(statusCount).map(([status, count]) => ({ status, count }))

    /* ── Symptom frequency ────────────────────────────────────────────────── */
    const symptomCount: Record<string, number> = {}
    SYMPTOMS.forEach(s => { symptomCount[s] = 0 })
    allJobs.forEach(j => j.symptoms.forEach(s => {
      symptomCount[s] = (symptomCount[s] ?? 0) + 1
    }))
    const symptomFreq = Object.entries(symptomCount)
      .map(([symptom, count]) => ({ symptom, count }))
      .sort((a, b) => b.count - a.count)

    /* ── Jobs by day of week ──────────────────────────────────────────────── */
    const dowCount = [0, 0, 0, 0, 0, 0, 0]
    allJobs.forEach(j => { dowCount[new Date(j.date + 'T00:00:00').getDay()]++ })
    const jobsByDow = DAYS_TH.map((day, i) => ({ day, count: dowCount[i] }))

    /* ── Customer clusters ────────────────────────────────────────────────── */
    const cMap: Record<string, {
      name: string; phone: string; visits: number; totalSpend: number; lastVisit: string
    }> = {}
    allJobs.forEach(j => {
      if (!cMap[j.phone]) {
        cMap[j.phone] = { name: j.customerName, phone: j.phone, visits: 0, totalSpend: 0, lastVisit: j.date }
      }
      cMap[j.phone].visits++
      cMap[j.phone].totalSpend += j.totalPrice
      if (j.date > cMap[j.phone].lastVisit) cMap[j.phone].lastVisit = j.date
    })

    const customers = Object.values(cMap).map(c => {
      const recencyDays = Math.floor(
        (now.getTime() - new Date(c.lastVisit + 'T00:00:00').getTime()) / 86_400_000
      )
      return {
        ...c,
        recencyDays,
        avgSpend: Math.round(c.totalSpend / c.visits),
        totalSpend: Math.round(c.totalSpend),
        cluster: getCluster(c.visits, c.totalSpend, recencyDays),
      }
    }).sort((a, b) => b.totalSpend - a.totalSpend)

    const clusterOrder = ['VIP', 'ประจำ', 'ใหม่', 'เงียบหาย']
    const clusterSummary = clusterOrder.map(cluster => ({
      cluster,
      count: customers.filter(c => c.cluster === cluster).length,
    }))

    /* ── Top vehicles ─────────────────────────────────────────────────────── */
    const vMap: Record<string, { visits: number; totalSpend: number }> = {}
    allJobs.forEach(j => {
      if (!vMap[j.licensePlate]) vMap[j.licensePlate] = { visits: 0, totalSpend: 0 }
      vMap[j.licensePlate].visits++
      vMap[j.licensePlate].totalSpend += j.totalPrice
    })
    const topVehicles = Object.entries(vMap)
      .map(([licensePlate, v]) => ({ licensePlate, visits: v.visits, totalSpend: Math.round(v.totalSpend) }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10)

    return NextResponse.json({
      kpi: { revenueToday, revenueThisMonth, revenueThisYear, avgJobValue, totalJobs: allJobs.length, pendingJobs },
      revenueByMonth,
      statusDist,
      symptomFreq,
      jobsByDow,
      customerClusters: { summary: clusterSummary, customers },
      topVehicles,
    })
  } catch (err) {
    console.error('[GET /api/analytics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
