'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Form, Select, Button, Card, Typography, Alert, DatePicker,
  InputNumber, Space, Divider, Radio,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'

const { Title } = Typography

interface Shop { id: string; name: string }
interface PartnerRecord { id: string; partner: { id: string; name: string } }
interface StockItem { id: string; name: string; unit: string; availableQty: number }
interface PartRow { stockItemId: string; quantity: number }

export default function NewTransferPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transferType, setTransferType] = useState<'BRANCH' | 'PARTNER_SALE'>('BRANCH')
  const [branches, setBranches] = useState<Shop[]>([])
  const [partners, setPartners] = useState<Shop[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [parts, setParts] = useState<PartRow[]>([{ stockItemId: '', quantity: 1 }])

  useEffect(() => {
    fetch('/api/admin/shops').then(r => r.json()).then((shops: Shop[]) => setBranches(shops))
    fetch('/api/admin/partners')
      .then(r => r.json())
      .then((data: { accepted?: PartnerRecord[] } | PartnerRecord[]) => {
        // API returns { accepted, incoming, outgoing } for SHOP_ADMIN
        // or { accepted, pending } for SUPER_ADMIN
        const records = Array.isArray(data) ? data : (data.accepted ?? [])
        setPartners(records.map((r: PartnerRecord) => r.partner).filter(Boolean))
      })
    fetch('/api/stock').then(r => r.json()).then(setStockItems)
  }, [])

  function updatePart(index: number, field: keyof PartRow, value: string | number) {
    setParts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  function removePart(index: number) {
    setParts(prev => prev.filter((_, i) => i !== index))
  }

  async function onFinish(values: {
    toShopId: string
    deliveryDate: import('dayjs').Dayjs
    unitPrice?: number
  }) {
    const validParts = parts.filter(p => p.stockItemId && p.quantity > 0)
    if (validParts.length === 0) {
      setError('กรุณาเลือกอะไหล่อย่างน้อย 1 รายการ')
      return
    }
    if (transferType === 'PARTNER_SALE' && !values.unitPrice) {
      setError('กรุณาระบุราคาต่อหน่วยสำหรับการขายพันธมิตร')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stock/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: transferType,
          toShopId: values.toShopId,
          deliveryDate: values.deliveryDate.toISOString(),
          unitPrice: transferType === 'PARTNER_SALE' ? values.unitPrice : undefined,
          items: validParts,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'เกิดข้อผิดพลาด'); return }
      router.push('/stock/transfers')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  const destinationShops = transferType === 'BRANCH' ? branches : partners

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 640 }}>
      <Title level={4}>สร้างคำสั่งโอนอะไหล่</Title>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>

          <Form.Item label="ประเภทการโอน">
            <Radio.Group
              value={transferType}
              onChange={e => {
                setTransferType(e.target.value)
                form.setFieldValue('toShopId', undefined)
              }}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="BRANCH">โอนภายในสาขา</Radio.Button>
              <Radio.Button value="PARTNER_SALE">ขายพันธมิตร</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            label={transferType === 'BRANCH' ? 'สาขาปลายทาง' : 'ร้านพันธมิตร (ผู้ซื้อ)'}
            name="toShopId"
            rules={[{ required: true, message: 'กรุณาเลือกปลายทาง' }]}
          >
            <Select
              placeholder="เลือกร้าน"
              options={destinationShops.map(s => ({ label: s.name, value: s.id }))}
            />
          </Form.Item>

          {transferType === 'PARTNER_SALE' && (
            <Form.Item
              label="ราคาต่อหน่วย (฿)"
              name="unitPrice"
              rules={[{ required: true, message: 'กรุณาระบุราคาต่อหน่วย' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0.01} precision={2} placeholder="0.00" />
            </Form.Item>
          )}

          <Form.Item label="วันที่คาดว่าของจะถึง" name="deliveryDate" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Divider orientation="left">รายการอะไหล่</Divider>
          {parts.map((part, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 32px', gap: 8, marginBottom: 8 }}>
              <Select
                placeholder="เลือกอะไหล่"
                value={part.stockItemId || undefined}
                onChange={v => updatePart(index, 'stockItemId', v)}
                options={stockItems.map(s => ({
                  label: `${s.name} (พร้อมใช้ ${s.availableQty} ${s.unit})`,
                  value: s.id,
                }))}
              />
              <InputNumber
                min={1}
                value={part.quantity}
                onChange={v => updatePart(index, 'quantity', v ?? 1)}
                style={{ width: '100%' }}
              />
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => removePart(index)}
                disabled={parts.length === 1}
              />
            </div>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setParts(prev => [...prev, { stockItemId: '', quantity: 1 }])}
            style={{ marginBottom: 16 }}
          >
            เพิ่มรายการ
          </Button>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => router.back()}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {transferType === 'BRANCH' ? 'สร้างคำสั่งโอน' : 'ส่งคำขอขาย'}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
