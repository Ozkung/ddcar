'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Form, InputNumber, Select, Button, Card, Typography, Alert, Spin } from 'antd'

const { Title, Text } = Typography
const REASONS = ['รับของ', 'ตัดของหาย', 'ปรับปรุงยอด']

export default function AdjustStockPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [itemName, setItemName] = useState('')
  const [currentQty, setCurrentQty] = useState(0)

  useEffect(() => {
    fetch(`/api/stock/${params.id}`)
      .then(r => r.json())
      .then(item => { setItemName(item.name); setCurrentQty(item.quantity) })
      .finally(() => setFetching(false))
  }, [params.id])

  async function onFinish({ delta, reason }: { delta: number; reason: string }) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/stock/${params.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta, reason }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/stock')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) return <div style={{ padding: '2rem' }}><Spin /></div>

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 480 }}>
      <Title level={4}>ปรับยอดอะไหล่</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        {itemName} — คงเหลือปัจจุบัน: <strong>{currentQty}</strong>
      </Text>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="จำนวนที่ปรับ (+ รับ / - ตัด)"
            name="delta"
            rules={[{ required: true, message: 'กรุณาระบุจำนวน' }, { validator: (_, v) => v !== 0 ? Promise.resolve() : Promise.reject('ต้องไม่เป็น 0') }]}
          >
            <InputNumber style={{ width: '100%' }} placeholder="เช่น 10 หรือ -3" />
          </Form.Item>
          <Form.Item label="เหตุผล" name="reason" rules={[{ required: true }]}>
            <Select options={REASONS.map(r => ({ label: r, value: r }))} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => router.back()}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={loading}>ปรับยอด</Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
