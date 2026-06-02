'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Table, Input, Select, DatePicker, Button, Tag,
  Space, Typography, Tooltip, message
} from 'antd'
import { SearchOutlined, DownloadOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { RangePickerProps } from 'antd/es/date-picker'
import { useSSE } from '@/hooks/useSSE'

const { Title } = Typography
const { RangePicker } = DatePicker

const STATUSES = [
  'ลูกค้าอนุมัติซ่อมแล้ว',
  'ซ่อมเสร็จเรียบร้อยแล้ว',
  'ส่งมอบและเก็บเงินแล้ว',
]

const STATUS_COLORS: Record<string, string> = {
  'ลูกค้าอนุมัติซ่อมแล้ว':   'blue',
  'ซ่อมเสร็จเรียบร้อยแล้ว':  'orange',
  'ส่งมอบและเก็บเงินแล้ว':   'green',
}

interface JobRow {
  id: string
  jobNo: string
  date: string
  customerName: string
  licensePlate: string
  symptoms: string[]
  totalPrice: number
  status: string
}

export default function ReportPage() {
  const [data, setData]           = useState<JobRow[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(false)
  const [search, setSearch]       = useState('')
  const [status, setStatus]       = useState<string | undefined>()
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [page, setPage]           = useState(1)
  const [pageSize, setPageSize]   = useState(20)

  const isFilterChange = useRef(false)

  const buildParams = useCallback(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('pageSize', String(pageSize))
    if (search)   p.set('search', search)
    if (status)   p.set('status', status)
    if (dateFrom) p.set('dateFrom', dateFrom)
    if (dateTo)   p.set('dateTo', dateTo)
    return p
  }, [page, pageSize, search, status, dateFrom, dateTo])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/jobs?${buildParams()}`)
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      setData(json.data)
      setTotal(json.total)
    } catch {
      message.error('โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useSSE((event) => {
    if (event.type === 'job_created' || event.type === 'job_status_changed') {
      fetchData()
    }
  })

  // When filters change: reset to page 1 and fetch
  useEffect(() => {
    isFilterChange.current = true
    setPage(1)
  }, [search, status, dateFrom, dateTo])

  // Fetch whenever page/pageSize changes, OR after filter-reset lands
  useEffect(() => {
    if (isFilterChange.current) {
      isFilterChange.current = false
      // page was just reset to 1; this effect fires with page=1 already
    }
    fetchData()
  }, [fetchData])

  const handleDateRange: RangePickerProps['onChange'] = (_, strings) => {
    setDateFrom(strings[0])
    setDateTo(strings[1])
  }

  const handleExport = () => {
    const params = buildParams()
    // Remove pagination params for full export
    params.delete('page')
    params.delete('pageSize')
    window.open(`/api/jobs/export?${params}`, '_blank')
  }

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current ?? 1)
    setPageSize(pagination.pageSize ?? 20)
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    // Optimistic update
    setData(prev => prev.map(row => row.id === id ? { ...row, status: newStatus } : row))
    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('update failed')
      message.success('อัปเดตสถานะเรียบร้อย')
    } catch {
      message.error('อัปเดตสถานะไม่สำเร็จ')
      fetchData() // Revert to server state on error
    }
  }

  const columns: ColumnsType<JobRow> = [
    {
      title: 'เลขที่ใบงาน',
      dataIndex: 'jobNo',
      key: 'jobNo',
      render: (jobNo: string, record: JobRow) => (
        <a href={`/receipt/${record.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
          {jobNo}
        </a>
      ),
    },
    { title: 'วันที่', dataIndex: 'date', key: 'date', width: 110 },
    { title: 'ชื่อลูกค้า', dataIndex: 'customerName', key: 'customerName' },
    { title: 'ทะเบียนรถ', dataIndex: 'licensePlate', key: 'licensePlate', width: 110 },
    {
      title: 'อาการ',
      dataIndex: 'symptoms',
      key: 'symptoms',
      render: (symptoms: string[]) => symptoms.join(', ') || '—',
      ellipsis: true,
    },
    {
      title: 'ราคาสุทธิ (บาท)',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      align: 'right',
      width: 130,
      render: (price: number) => price.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 220,
      render: (s: string, record: JobRow) => (
        <Select
          value={s}
          size="small"
          style={{ width: '100%' }}
          onChange={(newStatus) => handleStatusChange(record.id, newStatus)}
          options={STATUSES.map(st => ({
            label: <Tag color={STATUS_COLORS[st] ?? 'default'} style={{ margin: 0 }}>{st}</Tag>,
            value: st,
          }))}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_: unknown, record: JobRow) => (
        <Space size={4}>
          <Tooltip title="ดูใบงาน">
            <Button
              type="text"
              icon={<EyeOutlined />}
              href={`/receipt/${record.id}`}
              target="_blank"
            />
          </Tooltip>
          <Tooltip title="แก้ไข">
            <Button
              type="text"
              icon={<EditOutlined />}
              href={`/edit/${record.id}`}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 20 }}>📋 รายงานงานซ่อม</Title>

      {/* Filter bar */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="ค้นหาชื่อลูกค้า / ทะเบียนรถ"
          style={{ width: 260 }}
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <RangePicker
          placeholder={['วันที่เริ่มต้น', 'วันที่สิ้นสุด']}
          onChange={handleDateRange}
          format="YYYY-MM-DD"
        />
        <Select
          placeholder="กรองตามสถานะ"
          allowClear
          style={{ width: 220 }}
          value={status}
          onChange={setStatus}
          options={STATUSES.map(s => ({ label: s, value: s }))}
        />
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          ส่งออก CSV
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 900 }}
        size="middle"
      />
    </div>
  )
}
