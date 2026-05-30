'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Form, Input, Select, Button, Card, Typography, Alert, Switch } from 'antd'

const { Title } = Typography

const ROLE_OPTIONS = [
  { value: 'SHOP_ADMIN', label: 'Shop Admin' },
  { value: 'LEAD_TECH',  label: 'หัวหน้าช่าง' },
  { value: 'TECH',       label: 'ช่าง' },
]

export default function EditUserPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/users`)
      .then((r) => r.json())
      .then((users: any[]) => {
        const user = users.find((u) => u.id === params.id)
        if (user) form.setFieldsValue({ name: user.name, role: user.role, isActive: user.isActive })
      })
      .finally(() => setFetching(false))
  }, [params.id, form])

  async function onFinish(values: { name: string; role: string; isActive: boolean; newPassword?: string }) {
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, any> = { name: values.name, role: values.role, isActive: values.isActive }
      if (values.newPassword) body.password = values.newPassword

      const res = await fetch(`/api/admin/users/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  if (fetching) return <div style={{ padding: '2rem' }}>กำลังโหลด...</div>

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 480 }}>
      <Title level={4}>แก้ไขผู้ใช้</Title>
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="ชื่อ" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Role" name="role" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item label="สถานะ" name="isActive" valuePropName="checked">
            <Switch checkedChildren="ใช้งาน" unCheckedChildren="ปิด" />
          </Form.Item>
          <Form.Item label="Password ใหม่ (เว้นว่างถ้าไม่เปลี่ยน)" name="newPassword"
            rules={[{ min: 8, message: 'อย่างน้อย 8 ตัวอักษร' }]}>
            <Input.Password placeholder="เว้นว่างถ้าไม่เปลี่ยน" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => router.back()}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={loading}>บันทึก</Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
