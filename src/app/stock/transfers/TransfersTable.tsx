'use client'

import { useState } from 'react'
import { Table, Tag, Button, Modal, Input, Space, message, Tabs, Typography } from 'antd'
import dayjs from 'dayjs'

const { Title } = Typography

const STATUS_COLORS: Record<string, string> = {
  PENDING:    'gold',
  IN_TRANSIT: 'blue',
  DELIVERED:  'green',
  DISPUTED:   'orange',
  REJECTED:   'red',
  CANCELLED:  'default',
}
const STATUS_LABELS: Record<string, string> = {
  PENDING:    'รออนุมัติ',
  IN_TRANSIT: 'กำลังส่ง',
  DELIVERED:  'ส่งแล้ว',
  DISPUTED:   'ร้องขอ',
  REJECTED:   'ปฏิเสธ',
  CANCELLED:  'ยกเลิก',
}

interface TransferItem {
  id: string
  quantity: number
  stockItem: { name: string; unit: string }
}

interface Transfer {
  id: string
  type: string
  fromShopId: string
  toShopId: string
  fromShop: { name: string }
  toShop: { name: string }
  status: string
  deliveryDate: string | Date
  unitPrice: number | null
  items: TransferItem[]
  disputes: { message: string }[]
}

interface Props {
  branchTransfers: Transfer[]
  partnerTransfers: Transfer[]
  currentShopId: string
  canManage: boolean
}

export default function TransfersTable({ branchTransfers, partnerTransfers, currentShopId, canManage }: Props) {
  const [disputeId, setDisputeId] = useState<string | null>(null)
  const [disputeMsg, setDisputeMsg] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  async function patchTransfer(id: string, status: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/stock/transfers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { message.error(data.error ?? 'เกิดข้อผิดพลาด'); return }
      const labels: Record<string, string> = {
        DELIVERED:  'ยืนยันรับของสำเร็จ',
        IN_TRANSIT: 'อนุมัติสำเร็จ',
        REJECTED:   'ปฏิเสธสำเร็จ',
        CANCELLED:  'ยกเลิกสำเร็จ',
      }
      message.success(labels[status] ?? 'สำเร็จ')
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { message.error(data.error ?? 'เกิดข้อผิดพลาด'); return }
      message.success('ร้องขอสำเร็จ')
      setDisputeId(null)
      setDisputeMsg('')
      window.location.reload()
    } finally {
      setActionLoading(false)
    }
  }

  function branchColumns() {
    return [
      {
        title: 'ต้นทาง → ปลายทาง',
        key: 'route',
        render: (_: unknown, r: Transfer) => `${r.fromShop.name} → ${r.toShop.name}`,
      },
      {
        title: 'สถานะ',
        dataIndex: 'status',
        key: 'status',
        render: (s: string) => <Tag color={STATUS_COLORS[s] ?? 'default'}>{STATUS_LABELS[s] ?? s}</Tag>,
      },
      {
        title: 'วันส่งถึง',
        dataIndex: 'deliveryDate',
        key: 'deliveryDate',
        render: (d: string | Date) => dayjs(d).format('DD/MM/YYYY'),
      },
      {
        title: 'รายการของ',
        dataIndex: 'items',
        key: 'items',
        render: (items: TransferItem[]) =>
          items.map(i => `${i.stockItem.name} ×${i.quantity} ${i.stockItem.unit}`).join(', '),
      },
      ...(canManage ? [{
        title: '',
        key: 'actions',
        render: (_: unknown, r: Transfer) => {
          if (r.status !== 'IN_TRANSIT' && r.status !== 'DISPUTED') return null
          if (r.toShopId !== currentShopId) return null
          return (
            <Space size="small">
              <Button size="small" type="primary" loading={actionLoading}
                onClick={() => patchTransfer(r.id, 'DELIVERED')}>
                ยืนยันรับ
              </Button>
              {r.status === 'IN_TRANSIT' && (
                <Button size="small" danger onClick={() => setDisputeId(r.id)}>ร้องขอ</Button>
              )}
            </Space>
          )
        },
      }] : []),
    ]
  }

  function partnerColumns() {
    return [
      {
        title: 'ผู้ขาย → ผู้ซื้อ',
        key: 'route',
        render: (_: unknown, r: Transfer) => `${r.fromShop.name} → ${r.toShop.name}`,
      },
      {
        title: 'สถานะ',
        dataIndex: 'status',
        key: 'status',
        render: (s: string) => <Tag color={STATUS_COLORS[s] ?? 'default'}>{STATUS_LABELS[s] ?? s}</Tag>,
      },
      {
        title: 'ราคา/หน่วย (฿)',
        dataIndex: 'unitPrice',
        key: 'unitPrice',
        align: 'right' as const,
        render: (v: number | null) =>
          v != null ? v.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-',
      },
      {
        title: 'วันส่งถึง',
        dataIndex: 'deliveryDate',
        key: 'deliveryDate',
        render: (d: string | Date) => dayjs(d).format('DD/MM/YYYY'),
      },
      {
        title: 'รายการของ',
        dataIndex: 'items',
        key: 'items',
        render: (items: TransferItem[]) =>
          items.map(i => `${i.stockItem.name} ×${i.quantity} ${i.stockItem.unit}`).join(', '),
      },
      ...(canManage ? [{
        title: '',
        key: 'actions',
        render: (_: unknown, r: Transfer) => {
          const isDestination = r.toShopId === currentShopId
          const isSource = r.fromShopId === currentShopId
          return (
            <Space size="small">
              {r.status === 'PENDING' && isDestination && (
                <>
                  <Button size="small" type="primary" loading={actionLoading}
                    onClick={() => patchTransfer(r.id, 'IN_TRANSIT')}>
                    อนุมัติ
                  </Button>
                  <Button size="small" danger loading={actionLoading}
                    onClick={() => patchTransfer(r.id, 'REJECTED')}>
                    ปฏิเสธ
                  </Button>
                </>
              )}
              {(r.status === 'IN_TRANSIT' || r.status === 'DISPUTED') && isDestination && (
                <Button size="small" type="primary" loading={actionLoading}
                  onClick={() => patchTransfer(r.id, 'DELIVERED')}>
                  ยืนยันรับ
                </Button>
              )}
              {r.status === 'PENDING' && isSource && (
                <Button size="small" loading={actionLoading}
                  onClick={() => patchTransfer(r.id, 'CANCELLED')}>
                  ยกเลิก
                </Button>
              )}
            </Space>
          )
        },
      }] : []),
    ]
  }

  return (
    <>
      <Title level={4} style={{ marginBottom: 16 }}>ประวัติการโอนอะไหล่</Title>
      <Tabs
        items={[
          {
            key: 'branch',
            label: `โอนภายในสาขา (${branchTransfers.length})`,
            children: (
              <Table
                dataSource={branchTransfers}
                columns={branchColumns()}
                rowKey="id"
                pagination={{ pageSize: 20 }}
                size="small"
              />
            ),
          },
          {
            key: 'partner',
            label: `ขายพันธมิตร (${partnerTransfers.length})`,
            children: (
              <Table
                dataSource={partnerTransfers}
                columns={partnerColumns()}
                rowKey="id"
                pagination={{ pageSize: 20 }}
                size="small"
              />
            ),
          },
        ]}
      />
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
