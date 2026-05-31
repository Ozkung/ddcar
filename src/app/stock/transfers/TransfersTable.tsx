'use client'

import { useState } from 'react'
import { Table, Tag, Button, Modal, Input, Space, message } from 'antd'
import dayjs from 'dayjs'

const STATUS_COLORS: Record<string, string> = {
  IN_TRANSIT: 'blue',
  DELIVERED:  'green',
  DISPUTED:   'orange',
  CANCELLED:  'default',
}
const STATUS_LABELS: Record<string, string> = {
  IN_TRANSIT: 'กำลังส่ง',
  DELIVERED:  'ส่งแล้ว',
  DISPUTED:   'ร้องขอ',
  CANCELLED:  'ยกเลิก',
}

interface TransferItem {
  id: string
  quantity: number
  stockItem: { name: string; unit: string }
}

interface Transfer {
  id: string
  fromShop: { name: string }
  toShop: { name: string }
  status: string
  deliveryDate: string
  items: TransferItem[]
  disputes: { message: string }[]
}

interface Props {
  transfers: Transfer[]
  currentShopId: string
  canManage: boolean
}

export default function TransfersTable({ transfers, currentShopId, canManage }: Props) {
  const [disputeId, setDisputeId] = useState<string | null>(null)
  const [disputeMsg, setDisputeMsg] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  async function confirmDelivery(id: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/stock/transfers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DELIVERED' }),
      })
      if (!res.ok) { const d = await res.json(); message.error(d.error); return }
      message.success('ยืนยันรับของสำเร็จ')
      window.location.reload()
    } finally {
      setActionLoading(false)
    }
  }

  async function submitDispute() {
    if (!disputeId || !disputeMsg.trim()) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/stock/transfers/${disputeId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: disputeMsg }),
      })
      if (!res.ok) { const d = await res.json(); message.error(d.error); return }
      message.success('ร้องขอสำเร็จ')
      setDisputeId(null)
      setDisputeMsg('')
      window.location.reload()
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    {
      title: 'ต้นทาง → ปลายทาง',
      key: 'route',
      render: (_: unknown, r: Transfer) => `${r.fromShop.name} → ${r.toShop.name}`,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_COLORS[s] || 'default'}>{STATUS_LABELS[s] || s}</Tag>,
    },
    {
      title: 'วันส่งถึง',
      dataIndex: 'deliveryDate',
      key: 'deliveryDate',
      render: (d: string) => dayjs(d).format('DD/MM/YYYY'),
    },
    {
      title: 'รายการของ',
      dataIndex: 'items',
      key: 'items',
      render: (items: TransferItem[]) =>
        items.map(i => `${i.stockItem.name} ×${i.quantity} ${i.stockItem.unit}`).join(', '),
    },
    ...(canManage
      ? [
          {
            title: '',
            key: 'actions',
            render: (_: unknown, r: Transfer) => {
              if (r.status !== 'IN_TRANSIT' && r.status !== 'DISPUTED') return null

              return (
                <Space size="small">
                  <Button
                    size="small"
                    type="primary"
                    loading={actionLoading}
                    onClick={() => confirmDelivery(r.id)}
                  >
                    ยืนยันรับ
                  </Button>
                  {r.status === 'IN_TRANSIT' && (
                    <Button size="small" danger onClick={() => setDisputeId(r.id)}>
                      ร้องขอ
                    </Button>
                  )}
                </Space>
              )
            },
          },
        ]
      : []),
  ]

  return (
    <>
      <Table dataSource={transfers} columns={columns} rowKey="id" pagination={{ pageSize: 20 }} size="small" />
      <Modal
        open={!!disputeId}
        title="ร้องขอ — ของยังไม่ถึง"
        onOk={submitDispute}
        onCancel={() => { setDisputeId(null); setDisputeMsg('') }}
        confirmLoading={actionLoading}
        okText="ยืนยัน"
        cancelText="ยกเลิก"
      >
        <Input.TextArea
          rows={3}
          placeholder="ระบุรายละเอียดที่ยังไม่ได้รับ"
          value={disputeMsg}
          onChange={e => setDisputeMsg(e.target.value)}
        />
      </Modal>
    </>
  )
}
