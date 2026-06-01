'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Tag, Button, Space, message, Tabs, Typography, Popconfirm } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import Link from 'next/link'

const { Title } = Typography

interface JobInfo {
  id: string
  jobNo: string
  customerName: string
  licensePlate: string
  status: string
  date: string
}

interface Transfer {
  id: string
  jobId: string
  status: 'PENDING' | 'ACCEPTED'
  note: string | null
  createdAt: string
  job: JobInfo
  fromShop: { name: string; refCode: string }
}

interface Props {
  transfers: Transfer[]
  canManage: boolean
}

export default function IncomingJobsTable({ transfers, canManage }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function doAction(jobId: string, action: 'accept' | 'reject') {
    setLoading(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/transfer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { message.error(data.error ?? 'เกิดข้อผิดพลาด'); return }
      message.success(action === 'accept' ? 'รับงานสำเร็จ' : 'ปฏิเสธงานสำเร็จ')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const pending = transfers.filter(t => t.status === 'PENDING')
  const accepted = transfers.filter(t => t.status === 'ACCEPTED')

  const pendingColumns: ColumnsType<Transfer> = [
    { title: 'เลขที่ใบงาน', dataIndex: ['job', 'jobNo'], key: 'jobNo' },
    { title: 'ลูกค้า',      dataIndex: ['job', 'customerName'], key: 'customerName' },
    { title: 'ทะเบียน',     dataIndex: ['job', 'licensePlate'], key: 'licensePlate' },
    { title: 'จากร้าน',     key: 'fromShop', render: (_: unknown, r: Transfer) => `${r.fromShop.name} (${r.fromShop.refCode})` },
    { title: 'วันที่',      dataIndex: ['job', 'date'], key: 'date' },
    { title: 'หมายเหตุ',    dataIndex: 'note', key: 'note', render: (v: string | null) => v || '—' },
    {
      title: 'การดำเนินการ',
      key: 'actions',
      render: (_: unknown, r: Transfer) => canManage ? (
        <Space>
          <Button type="primary" size="small" loading={loading} onClick={() => doAction(r.job.id, 'accept')}>
            รับงาน
          </Button>
          <Popconfirm title="ยืนยันปฏิเสธงานนี้?" onConfirm={() => doAction(r.job.id, 'reject')} okText="ปฏิเสธ" cancelText="ยกเลิก">
            <Button danger size="small" loading={loading}>ปฏิเสธ</Button>
          </Popconfirm>
        </Space>
      ) : null,
    },
  ]

  const acceptedColumns: ColumnsType<Transfer> = [
    { title: 'เลขที่ใบงาน', dataIndex: ['job', 'jobNo'], key: 'jobNo' },
    { title: 'ลูกค้า',      dataIndex: ['job', 'customerName'], key: 'customerName' },
    { title: 'ทะเบียน',     dataIndex: ['job', 'licensePlate'], key: 'licensePlate' },
    { title: 'จากร้าน',     key: 'fromShop', render: (_: unknown, r: Transfer) => `${r.fromShop.name} (${r.fromShop.refCode})` },
    { title: 'สถานะ',       key: 'status',   render: (_: unknown, r: Transfer) => <Tag color="blue">{r.job.status}</Tag> },
    {
      title: 'การดำเนินการ',
      key: 'actions',
      render: (_: unknown, r: Transfer) => (
        <Link href={`/edit/${r.job.id}`}>
          <Button size="small">แก้ไข / อัปเดต</Button>
        </Link>
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>งานที่รับโอน</Title>
      <Tabs
        defaultActiveKey="pending"
        items={[
          {
            key: 'pending',
            label: `รอรับ (${pending.length})`,
            children: (
              <Table
                dataSource={pending}
                columns={pendingColumns}
                rowKey="id"
                pagination={{ pageSize: 20 }}
                locale={{ emptyText: 'ไม่มีงานรอรับ' }}
              />
            ),
          },
          {
            key: 'accepted',
            label: `กำลังดำเนินการ (${accepted.length})`,
            children: (
              <Table
                dataSource={accepted}
                columns={acceptedColumns}
                rowKey="id"
                pagination={{ pageSize: 20 }}
                locale={{ emptyText: 'ไม่มีงานที่กำลังดำเนินการ' }}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
