'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Form, Input, InputNumber, Select, Button, Card, Typography, Alert, DatePicker, Spin } from 'antd'
import dayjs from 'dayjs'

const { Title } = Typography
const CATEGORIES = ['น้ำมัน', 'ยาง', 'ไฟฟ้า', 'ช่วงล่าง', 'อื่นๆ']
const UNITS = ['ชิ้น', 'ลิตร', 'กก.', 'ม้วน']

export default function EditStockItemPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/stock/${params.id}`)
      .then(r => r.json())
      .then(item => {
        form.setFieldsValue({
          name: item.name,
          category: item.category,
          unit: item.unit,
          costPrice: item.costPrice,
          supplierPhone: item.supplierPhone,
          warrantyStart: item.warrantyStart ? dayjs(item.warrantyStart) : null,
          warrantyEnd:   item.warrantyEnd   ? dayjs(item.warrantyEnd)   : null,
        })
      })
      .finally(() => setFetching(false))
  }, [params.id, form])

  async function onFinish(values: Record<string, unknown>) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/stock/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          warrantyStart: values.warrantyStart ? (values.warrantyStart as import('dayjs').Dayjs).toISOString() : null,
          warrantyEnd:   values.warrantyEnd   ? (values.warrantyEnd   as import('dayjs').Dayjs).toISOString() : null,
        }),
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
    <div style={{ padding: '1.5rem 2rem', maxWidth: 560 }}>
      <Title level={4}>แก้ไขข้อมูลอะไหล่</Title>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="ชื่ออะไหล่" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="หมวดหมู่" name="category" rules={[{ required: true }]}>
              <Select options={CATEGORIES.map(c => ({ label: c, value: c }))} />
            </Form.Item>
            <Form.Item label="หน่วย" name="unit" rules={[{ required: true }]}>
              <Select options={UNITS.map(u => ({ label: u, value: u }))} />
            </Form.Item>
          </div>
          <Form.Item label="ราคาทุน (บาท)" name="costPrice" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item label="เบอร์ร้านอะไหล่" name="supplierPhone">
            <Input />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="วันเริ่มรับประกัน" name="warrantyStart">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="วันหมดประกัน" name="warrantyEnd">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => router.back()}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={loading}>บันทึก</Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
