'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table, Button, Input, Space, Modal, message, Typography,
  Popconfirm, Tag, Select, Tabs, Card,
} from 'antd'
import { PlusOutlined, CopyOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

interface ShopInfo { id: string; name: string; refCode?: string }
interface PartnerRecord {
  id: string
  shop?: ShopInfo
  partner?: ShopInfo
  status: string
  createdAt: string | Date
}

interface Props {
  role: string
  myRefCode: string
  // SUPER_ADMIN
  accepted?: PartnerRecord[]
  pending?: PartnerRecord[]
  shops?: ShopInfo[]
  // SHOP_ADMIN
  incoming?: PartnerRecord[]
  outgoing?: PartnerRecord[]
}

export default function PartnersTable({
  role, myRefCode,
  accepted = [], pending = [],
  shops = [], incoming = [], outgoing = [],
}: Props) {
  const router = useRouter()
  const [refCodeInput, setRefCodeInput] = useState('')
  const [sending, setSending] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

  // SUPER_ADMIN direct-add modal
  const [directOpen, setDirectOpen] = useState(false)
  const [shopAId, setShopAId] = useState<string | undefined>()
  const [shopBId, setShopBId] = useState<string | undefined>()
  const [directSaving, setDirectSaving] = useState(false)

  async function sendInvite() {
    if (!refCodeInput.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refCode: refCodeInput.trim().toUpperCase() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { message.error(data.error ?? 'เกิดข้อผิดพลาด'); return }
      message.success(`ส่งคำขอไปยัง ${data.targetName} สำเร็จ`)
      setRefCodeInput('')
      router.refresh()
    } finally {
      setSending(false)
    }
  }

  async function acceptRequest(id: string) {
    setActionId(id)
    try {
      const res = await fetch(`/api/admin/partners/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); message.error(d.error ?? 'เกิดข้อผิดพลาด'); return }
      message.success('รับเป็นพันธมิตรสำเร็จ')
      router.refresh()
    } finally {
      setActionId(null)
    }
  }

  async function removePartner(id: string) {
    setActionId(id)
    try {
      const res = await fetch(`/api/admin/partners/${id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); message.error(d.error ?? 'เกิดข้อผิดพลาด'); return }
      message.success('ลบพันธมิตรสำเร็จ')
      router.refresh()
    } finally {
      setActionId(null)
    }
  }

  async function directAdd() {
    if (!shopAId || !shopBId) return
    setDirectSaving(true)
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopAId, shopBId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { message.error(data.error ?? 'เกิดข้อผิดพลาด'); return }
      message.success('เพิ่มพันธมิตรสำเร็จ')
      setDirectOpen(false)
      setShopAId(undefined)
      setShopBId(undefined)
      router.refresh()
    } finally {
      setDirectSaving(false)
    }
  }

  // ── Columns ──────────────────────────────────────────────────────────────

  const acceptedCols = [
    {
      title: 'ร้าน A',
      key: 'shopA',
      render: (_: unknown, r: PartnerRecord) => r.shop?.name ?? '-',
    },
    {
      title: 'ร้าน B',
      key: 'shopB',
      render: (_: unknown, r: PartnerRecord) => r.partner?.name ?? '-',
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, r: PartnerRecord) => (
        <Popconfirm title="ยืนยันลบพันธมิตร?" onConfirm={() => removePartner(r.id)} okText="ลบ" cancelText="ยกเลิก">
          <Button size="small" danger loading={actionId === r.id}>ลบ</Button>
        </Popconfirm>
      ),
    },
  ]

  const pendingCols = [
    {
      title: 'ผู้ส่งคำขอ',
      key: 'from',
      render: (_: unknown, r: PartnerRecord) => r.shop?.name ?? '-',
    },
    {
      title: 'ไปยัง',
      key: 'to',
      render: (_: unknown, r: PartnerRecord) => r.partner?.name ?? '-',
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, r: PartnerRecord) => (
        <Space>
          <Button size="small" type="primary" loading={actionId === r.id} onClick={() => acceptRequest(r.id)}>
            อนุมัติ
          </Button>
          <Popconfirm title="ปฏิเสธคำขอ?" onConfirm={() => removePartner(r.id)} okText="ปฏิเสธ" cancelText="ยกเลิก">
            <Button size="small" danger loading={actionId === r.id}>ปฏิเสธ</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const incomingCols = [
    {
      title: 'จากร้าน',
      key: 'from',
      render: (_: unknown, r: PartnerRecord) => r.shop?.name ?? '-',
    },
    {
      title: 'Ref Code',
      key: 'refCode',
      render: (_: unknown, r: PartnerRecord) => <Tag>{r.shop?.refCode ?? '-'}</Tag>,
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, r: PartnerRecord) => (
        <Space>
          <Button size="small" type="primary" loading={actionId === r.id} onClick={() => acceptRequest(r.id)}>
            รับ
          </Button>
          <Popconfirm title="ปฏิเสธคำขอ?" onConfirm={() => removePartner(r.id)} okText="ปฏิเสธ" cancelText="ยกเลิก">
            <Button size="small" danger loading={actionId === r.id}>ปฏิเสธ</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const outgoingCols = [
    {
      title: 'ร้านที่ส่งคำขอไป',
      key: 'to',
      render: (_: unknown, r: PartnerRecord) => r.partner?.name ?? '-',
    },
    {
      title: 'Ref Code',
      key: 'refCode',
      render: (_: unknown, r: PartnerRecord) => <Tag>{r.partner?.refCode ?? '-'}</Tag>,
    },
    {
      title: 'สถานะ',
      key: 'status',
      render: () => <Tag color="gold">รออนุมัติ</Tag>,
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, r: PartnerRecord) => (
        <Popconfirm title="ยกเลิกคำขอ?" onConfirm={() => removePartner(r.id)} okText="ยกเลิก" cancelText="ปิด">
          <Button size="small" loading={actionId === r.id}>ยกเลิกคำขอ</Button>
        </Popconfirm>
      ),
    },
  ]

  const myPartnersCols = [
    {
      title: 'ร้านพันธมิตร',
      key: 'name',
      render: (_: unknown, r: PartnerRecord) => r.partner?.name ?? '-',
    },
    {
      title: 'Ref Code',
      key: 'refCode',
      render: (_: unknown, r: PartnerRecord) => <Tag>{r.partner?.refCode ?? '-'}</Tag>,
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, r: PartnerRecord) => (
        <Popconfirm title="ยืนยันลบพันธมิตร?" onConfirm={() => removePartner(r.id)} okText="ลบ" cancelText="ยกเลิก">
          <Button size="small" danger loading={actionId === r.id}>ลบ</Button>
        </Popconfirm>
      ),
    },
  ]

  // ── SUPER_ADMIN view ──────────────────────────────────────────────────────
  if (role === 'SUPER_ADMIN') {
    return (
      <div style={{ padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>จัดการพันธมิตร</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDirectOpen(true)}>
            เพิ่มพันธมิตร
          </Button>
        </div>

        <Tabs
          items={[
            {
              key: 'accepted',
              label: `พันธมิตรทั้งหมด (${accepted.length})`,
              children: (
                <Table dataSource={accepted} columns={acceptedCols} rowKey="id" size="small" pagination={{ pageSize: 20 }} />
              ),
            },
            {
              key: 'pending',
              label: `คำขอที่รอ (${pending.length})`,
              children: (
                <Table dataSource={pending} columns={pendingCols} rowKey="id" size="small" pagination={{ pageSize: 20 }} />
              ),
            },
          ]}
        />

        <Modal
          open={directOpen}
          title="เพิ่มพันธมิตรโดยตรง"
          onOk={directAdd}
          onCancel={() => { setDirectOpen(false); setShopAId(undefined); setShopBId(undefined) }}
          confirmLoading={directSaving}
          okText="เพิ่ม"
          cancelText="ยกเลิก"
          okButtonProps={{ disabled: !shopAId || !shopBId || shopAId === shopBId }}
        >
          <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size="middle">
            <div>
              <div style={{ marginBottom: 4 }}>ร้าน A</div>
              <Select
                style={{ width: '100%' }}
                placeholder="เลือกร้าน"
                value={shopAId}
                onChange={setShopAId}
                options={shops.map(s => ({ label: s.name, value: s.id }))}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4 }}>ร้าน B</div>
              <Select
                style={{ width: '100%' }}
                placeholder="เลือกร้าน"
                value={shopBId}
                onChange={setShopBId}
                options={shops.filter(s => s.id !== shopAId).map(s => ({ label: s.name, value: s.id }))}
              />
            </div>
          </Space>
        </Modal>
      </div>
    )
  }

  // ── SHOP_ADMIN / LEAD_TECH view ───────────────────────────────────────────
  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <Title level={4} style={{ marginBottom: 16 }}>จัดการพันธมิตร</Title>

      {/* My ref code */}
      <Card style={{ marginBottom: 24, maxWidth: 400 }}>
        <Text type="secondary">Ref Code ของร้านคุณ</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.15em', fontFamily: 'monospace' }}>
            {myRefCode}
          </span>
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={() =>
              navigator.clipboard.writeText(myRefCode)
                .then(() => message.success('คัดลอกแล้ว'))
                .catch(() => message.error('ไม่สามารถคัดลอกได้'))
            }
          />
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>แชร์ code นี้ให้ร้านที่ต้องการเชื่อมเป็นพันธมิตร</Text>
      </Card>

      {/* Send invite */}
      <Card title="ส่งคำขอเป็นพันธมิตร" style={{ marginBottom: 24, maxWidth: 400 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="กรอก Ref Code ของร้านพันธมิตร"
            value={refCodeInput}
            onChange={e => setRefCodeInput(e.target.value.toUpperCase())}
            onPressEnter={sendInvite}
            maxLength={6}
            style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}
          />
          <Button type="primary" loading={sending} onClick={sendInvite}>
            ส่งคำขอ
          </Button>
        </Space.Compact>
      </Card>

      <Tabs
        items={[
          {
            key: 'accepted',
            label: `พันธมิตร (${accepted.length})`,
            children: (
              <Table dataSource={accepted} columns={myPartnersCols} rowKey="id" size="small" pagination={false} />
            ),
          },
          {
            key: 'incoming',
            label: incoming.length > 0
              ? <span>คำขอที่รอ <Tag color="red">{incoming.length}</Tag></span>
              : 'คำขอที่รอ',
            children: (
              <Table dataSource={incoming} columns={incomingCols} rowKey="id" size="small" pagination={false} />
            ),
          },
          {
            key: 'outgoing',
            label: `คำขอที่ส่งไป (${outgoing.length})`,
            children: (
              <Table dataSource={outgoing} columns={outgoingCols} rowKey="id" size="small" pagination={false} />
            ),
          },
        ]}
      />
    </div>
  )
}
