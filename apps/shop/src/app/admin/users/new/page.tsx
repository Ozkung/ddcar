'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, Select, Button, Card, Typography, Alert } from 'antd'

const { Title } = Typography

const ROLE_OPTIONS = [
  { value: 'SHOP_ADMIN',  label: 'Shop Admin' },
  { value: 'LEAD_TECH',   label: 'หัวหน้าช่าง' },
  { value: 'TECH',        label: 'ช่าง' },
]

export default function NewUserPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFinish(values: {
    name: string; email: string; password: string; role: string
  }) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/admin/users')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 480 }}>
      <Title level={4}>เพิ่มผู้ใช้ใหม่</Title>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="ชื่อ" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Password" name="password" rules={[{ required: true, min: 8, message: 'อย่างน้อย 8 ตัวอักษร' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="Role" name="role" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => router.back()}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={loading}>เพิ่มผู้ใช้</Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
