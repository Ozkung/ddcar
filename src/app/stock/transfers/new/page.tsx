'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Form, Select, Button, Card, Typography, Alert, DatePicker,
  InputNumber, Space, Divider,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'

const { Title } = Typography

interface Shop { id: string; name: string }
interface StockItem { id: string; name: string; unit: string; availableQty: number }
interface PartRow { stockItemId: string; quantity: number }

export default function NewTransferPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [parts, setParts] = useState<PartRow[]>([{ stockItemId: '', quantity: 1 }])

  useEffect(() => {
    fetch('/api/admin/shops').then(r => r.json()).then(setShops)
    fetch('/api/stock').then(r => r.json()).then(setStockItems)
  }, [])

  function updatePart(index: number, field: keyof PartRow, value: string | number) {
    setParts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  function removePart(index: number) {
    setParts(prev => prev.filter((_, i) => i !== index))
  }

  async function onFinish(values: { toShopId: string; deliveryDate: import('dayjs').Dayjs }) {
    const validParts = parts.filter(p => p.stockItemId && p.quantity > 0)
    if (validParts.length === 0) {
      setError('กรุณาเลือกอะไหล่อย่างน้อย 1 รายการ')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stock/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toShopId: values.toShopId,
          deliveryDate: values.deliveryDate.toISOString(),
          items: validParts,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/stock/transfers')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 640 }}>
      <Title level={4}>โอนอะไหล่ไปสาขา</Title>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="สาขาปลายทาง" name="toShopId" rules={[{ required: true, message: 'กรุณาเลือกปลายทาง' }]}>
            <Select
              placeholder="เลือกสาขา"
              options={shops.map(s => ({ label: s.name, value: s.id }))}
            />
          </Form.Item>
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
            <Button type="primary" htmlType="submit" loading={loading}>สร้างคำสั่งโอน</Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
