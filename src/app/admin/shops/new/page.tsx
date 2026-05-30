'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, Typography, Alert } from 'antd'

const { Title } = Typography

export default function NewShopPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFinish({ name }: { name: string }) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/admin/shops')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 480 }}>
      <Title level={4}>สร้างร้านใหม่</Title>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="ชื่อร้าน" name="name" rules={[{ required: true }]}>
            <Input placeholder="ชื่อร้าน" size="large" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => router.back()}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              สร้างร้าน
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
