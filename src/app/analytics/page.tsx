'use client'

import { useEffect, useState } from 'react'
import {
  Card, Col, Row, Statistic, Tag, Typography,
  Table, Spin, message, Divider,
} from 'antd'
import {
  DollarOutlined, CarOutlined, ToolOutlined,
  ClockCircleOutlined, CheckCircleOutlined, WarningOutlined,
} from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  ComposedChart, Line,
} from 'recharts'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Kpi {
  revenueToday: number; revenueThisMonth: number; revenueThisYear: number
  avgJobValue: number; totalJobs: number; pendingJobs: number
}
interface CustomerRow {
  name: string; phone: string; visits: number; totalSpend: number
  avgSpend: number; lastVisit: string; recencyDays: number; cluster: string
}
interface AnalyticsData {
  kpi: Kpi
  revenueByMonth: { month: string; revenue: number; jobs: number }[]
  statusDist: { status: string; count: number }[]
  symptomFreq: { symptom: string; count: number }[]
  jobsByDow: { day: string; count: number }[]
  customerClusters: { summary: { cluster: string; count: number }[]; customers: CustomerRow[] }
  topVehicles: { licensePlate: string; visits: number; totalSpend: number }[]
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  'ลูกค้าอนุมัติซ่อมแล้ว':  '#1677ff',
  'ซ่อมเสร็จเรียบร้อยแล้ว': '#fa8c16',
  'ส่งมอบและเก็บเงินแล้ว':  '#52c41a',
}
const CLUSTER_COLORS: Record<string, string> = {
  'VIP': '#faad14', 'ประจำ': '#1677ff', 'ใหม่': '#52c41a', 'เงียบหาย': '#bfbfbf',
}
const CLUSTER_TAGS: Record<string, string> = {
  'VIP': 'gold', 'ประจำ': 'blue', 'ใหม่': 'green', 'เงียบหาย': 'default',
}
const BAR_COLORS = ['#1677ff', '#4096ff', '#69b1ff', '#91caff', '#bae0ff']
const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0 })

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function ChartCard({ title, height = 260, children }: {
  title: string; height?: number; children: React.ReactNode
}) {
  return (
    <Card size="small" style={{ height: '100%' }}>
      <Text strong style={{ display: 'block', marginBottom: 12 }}>{title}</Text>
      <div style={{ height }}>{children}</div>
    </Card>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const [data, setData]     = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setData)
      .catch(() => message.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" tip="กำลังโหลดข้อมูล..." />
      </div>
    )
  }
  if (!data) return null

  const { kpi, revenueByMonth, statusDist, symptomFreq, jobsByDow, customerClusters, topVehicles } = data

  /* ── Customer table columns ──────────────────────────────────────────────── */
  const customerCols: ColumnsType<CustomerRow> = [
    { title: 'ชื่อ-นามสกุล', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'เบอร์โทร', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: 'ครั้ง', dataIndex: 'visits', key: 'visits', width: 70, align: 'center', sorter: (a, b) => a.visits - b.visits },
    {
      title: 'ยอดรวม (บาท)', dataIndex: 'totalSpend', key: 'totalSpend',
      width: 140, align: 'right', sorter: (a, b) => a.totalSpend - b.totalSpend,
      render: (v: number) => fmt(v),
    },
    {
      title: 'เฉลี่ย/ครั้ง', dataIndex: 'avgSpend', key: 'avgSpend',
      width: 120, align: 'right', render: (v: number) => fmt(v),
    },
    { title: 'มาล่าสุด', dataIndex: 'lastVisit', key: 'lastVisit', width: 110 },
    {
      title: 'Cluster', dataIndex: 'cluster', key: 'cluster', width: 110,
      filters: ['VIP', 'ประจำ', 'ใหม่', 'เงียบหาย'].map(c => ({ text: c, value: c })),
      onFilter: (v, r) => r.cluster === v,
      render: (c: string) => <Tag color={CLUSTER_TAGS[c] ?? 'default'}>{c === 'VIP' ? '🌟 VIP' : c === 'ประจำ' ? '🔄 ประจำ' : c === 'ใหม่' ? '🆕 ใหม่' : '😴 เงียบหาย'}</Tag>,
    },
  ]

  const vehicleCols = [
    { title: 'ทะเบียนรถ', dataIndex: 'licensePlate', key: 'licensePlate' },
    { title: 'จำนวนครั้ง', dataIndex: 'visits', key: 'visits', align: 'center' as const, width: 110 },
    { title: 'ยอดรวม (บาท)', dataIndex: 'totalSpend', key: 'totalSpend', align: 'right' as const, render: (v: number) => fmt(v) },
  ]

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1300, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 20 }}>📊 วิเคราะห์ข้อมูล</Title>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { title: 'รายได้วันนี้', value: kpi.revenueToday, suffix: 'บาท', icon: <DollarOutlined />, color: '#1677ff' },
          { title: 'รายได้เดือนนี้', value: kpi.revenueThisMonth, suffix: 'บาท', icon: <DollarOutlined />, color: '#52c41a' },
          { title: 'รายได้ปีนี้', value: kpi.revenueThisYear, suffix: 'บาท', icon: <DollarOutlined />, color: '#722ed1' },
          { title: 'ราคาเฉลี่ย/งาน', value: kpi.avgJobValue, suffix: 'บาท', icon: <ToolOutlined />, color: '#fa8c16' },
          { title: 'งานทั้งหมด', value: kpi.totalJobs, suffix: 'งาน', icon: <CarOutlined />, color: '#13c2c2' },
          { title: 'งานค้างอยู่', value: kpi.pendingJobs, suffix: 'งาน', icon: kpi.pendingJobs > 5 ? <WarningOutlined /> : <CheckCircleOutlined />, color: kpi.pendingJobs > 5 ? '#ff4d4f' : '#52c41a' },
        ].map(({ title, value, suffix, icon, color }) => (
          <Col xs={12} sm={8} md={4} key={title}>
            <Card size="small" style={{ borderTop: `3px solid ${color}` }}>
              <Statistic
                title={<span style={{ fontSize: 12 }}>{title}</span>}
                value={value}
                suffix={<span style={{ fontSize: 12 }}>{suffix}</span>}
                prefix={<span style={{ color }}>{icon}</span>}
                valueStyle={{ fontSize: 18, fontWeight: 700 }}
                formatter={(v) => fmt(Number(v))}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Row 1: Revenue + Status ─────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <ChartCard title="💰 รายได้รายเดือน (12 เดือนย้อนหลัง)" height={280}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={revenueByMonth} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number, name: string) =>
                    name === 'รายได้' ? [`${fmt(v)} บาท`, name] : [v, name]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="revenue" name="รายได้" fill="#1677ff" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="jobs" name="จำนวนงาน" stroke="#fa8c16" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </Col>
        <Col xs={24} lg={8}>
          <ChartCard title="📋 สัดส่วนสถานะงาน" height={280}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusDist} dataKey="count" nameKey="status" cx="50%" cy="45%"
                  innerRadius={55} outerRadius={85} paddingAngle={3}
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {statusDist.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#8884d8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, name: string) => [`${v} งาน`, name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </Col>
      </Row>

      {/* ── Row 2: Symptoms + Day of week ──────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <ChartCard title="🔧 อาการที่พบบ่อย">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={symptomFreq} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="symptom" tick={{ fontSize: 11 }} width={110} />
                <Tooltip formatter={(v: number) => [`${v} งาน`, 'จำนวน']} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {symptomFreq.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Col>
        <Col xs={24} md={12}>
          <ChartCard title="📅 จำนวนงานแต่ละวันในสัปดาห์">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={jobsByDow} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [`${v} งาน`, 'จำนวน']} />
                <Bar dataKey="count" fill="#13c2c2" radius={[4, 4, 0, 0]}>
                  {jobsByDow.map((entry, i) => (
                    <Cell key={i} fill={entry.count === Math.max(...jobsByDow.map(d => d.count)) ? '#1677ff' : '#91caff'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Col>
      </Row>

      {/* ── Customer Clusters ───────────────────────────────────────────────── */}
      <Divider orientation="left"><Title level={5} style={{ margin: 0 }}>👥 Customer Clusters (RFM)</Title></Divider>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {/* Donut chart */}
        <Col xs={24} md={8}>
          <Card size="small" style={{ height: 300 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>สัดส่วน Cluster</Text>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={customerClusters.summary} dataKey="count" nameKey="cluster"
                  cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}
                  label={({ name, percent }) => percent > 0 ? `${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={false}
                >
                  {customerClusters.summary.map((entry) => (
                    <Cell key={entry.cluster} fill={CLUSTER_COLORS[entry.cluster] ?? '#8884d8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, name: string) => [`${v} คน`, name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Cluster summary cards */}
        <Col xs={24} md={16}>
          <Row gutter={[12, 12]}>
            {[
              { cluster: 'VIP', emoji: '🌟', desc: 'มา ≥ 4 ครั้ง หรือ ≥ 2 ครั้ง + ยอด ≥ 10,000 บาท' },
              { cluster: 'ประจำ', emoji: '🔄', desc: 'มา ≥ 2 ครั้ง ภายใน 1 ปี' },
              { cluster: 'ใหม่', emoji: '🆕', desc: 'มาครั้งแรก ภายใน 90 วัน' },
              { cluster: 'เงียบหาย', emoji: '😴', desc: 'ไม่มาเกิน 1 ปี หรือมา 1 ครั้ง แล้วหายไป' },
            ].map(({ cluster, emoji, desc }) => {
              const count = customerClusters.summary.find(s => s.cluster === cluster)?.count ?? 0
              return (
                <Col xs={12} key={cluster}>
                  <Card size="small" style={{ borderLeft: `4px solid ${CLUSTER_COLORS[cluster]}` }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: CLUSTER_COLORS[cluster] }}>{count}</div>
                    <div style={{ fontWeight: 600 }}>{emoji} {cluster}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{desc}</Text>
                  </Card>
                </Col>
              )
            })}
          </Row>
        </Col>
      </Row>

      {/* Customer table */}
      <Card size="small" style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 12 }}>รายชื่อลูกค้าทั้งหมด</Text>
        <Table
          columns={customerCols}
          dataSource={customerClusters.customers}
          rowKey="phone"
          size="small"
          pagination={{ pageSize: 10, showTotal: t => `ทั้งหมด ${t} คน` }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* ── Top Vehicles ────────────────────────────────────────────────────── */}
      <Divider orientation="left"><Title level={5} style={{ margin: 0 }}>🚗 ทะเบียนรถที่มาซ่อมบ่อย (Top 10)</Title></Divider>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card size="small">
            <Table
              columns={vehicleCols}
              dataSource={topVehicles}
              rowKey="licensePlate"
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" style={{ height: '100%' }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>จำนวนครั้งต่อทะเบียน</Text>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topVehicles} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="licensePlate" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v: number) => [`${v} ครั้ง`, 'จำนวน']} />
                  <Bar dataKey="visits" fill="#722ed1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
