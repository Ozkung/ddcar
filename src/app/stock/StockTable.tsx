'use client'

import { Table, Tag, Button, Space } from 'antd'
import Link from 'next/link'
import dayjs from 'dayjs'

interface StockItemRow {
  id: string
  name: string
  category: string
  unit: string
  quantity: number
  reserved: number
  availableQty: number
  costPrice: number
  warrantyEnd: Date | null
}

interface Props {
  items: StockItemRow[]
  canEdit: boolean
}

export default function StockTable({ items, canEdit }: Props) {
  const now = dayjs()

  const columns = [
    {
      title: 'ชื่ออะไหล่',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: StockItemRow) => {
        const low = record.availableQty < 5
        return (
          <span style={{ color: low ? '#dc2626' : undefined, fontWeight: low ? 600 : undefined }}>
            {name}
          </span>
        )
      },
    },
    {
      title: 'หมวดหมู่',
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit' },
    {
      title: 'คงเหลือ',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
    },
    {
      title: 'จอง',
      dataIndex: 'reserved',
      key: 'reserved',
      align: 'right' as const,
      render: (v: number) => <span style={{ color: v > 0 ? '#d97706' : '#94a3b8' }}>{v}</span>,
    },
    {
      title: 'พร้อมใช้',
      dataIndex: 'availableQty',
      key: 'availableQty',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: v < 5 ? '#dc2626' : '#16a34a' }}>{v}</span>
      ),
    },
    {
      title: 'ราคาทุน',
      dataIndex: 'costPrice',
      key: 'costPrice',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    {
      title: 'หมดประกัน',
      dataIndex: 'warrantyEnd',
      key: 'warrantyEnd',
      render: (v: Date | null) => {
        if (!v) return <span style={{ color: '#94a3b8' }}>-</span>
        const d = dayjs(v)
        const soonExpiry = d.diff(now, 'day') <= 30
        return (
          <span style={{ color: soonExpiry ? '#d97706' : undefined }}>
            {d.format('DD/MM/YYYY')}
          </span>
        )
      },
    },
    ...(canEdit
      ? [
          {
            title: '',
            key: 'actions',
            render: (_: unknown, record: StockItemRow) => (
              <Space size="small">
                <Link href={`/stock/${record.id}/adjust`}>
                  <Button size="small">ปรับยอด</Button>
                </Link>
                <Link href={`/stock/${record.id}/edit`}>
                  <Button size="small">แก้ไข</Button>
                </Link>
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <Table
      dataSource={items}
      columns={columns}
      rowKey="id"
      pagination={false}
      size="small"
    />
  )
}
