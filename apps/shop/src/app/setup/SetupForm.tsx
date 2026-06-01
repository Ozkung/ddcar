'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, Typography, Alert } from 'antd'
import { ShopOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export default function SetupForm() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ refCode: string; shopName: string } | null>(null)

  async function onFinish(values: {
    shopName: string
    adminName: string
    adminEmail: string
    adminPassword: string
    confirmPassword: string
  }) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: values.shopName,
          adminName: values.adminName,
          adminEmail: values.adminEmail,
          adminPassword: values.adminPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setDone(data)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f1f5f9' }}>
        <Card style={{ width: 480, textAlign: 'center' }}>
          <ShopOutlined style={{ fontSize: 48, color: '#2563eb', marginBottom: 16 }} />
          <Title level={3}>ตั้งค่าระบบสำเร็จ! ✅</Title>
          <Text>ร้าน: <strong>{done.shopName}</strong></Text>
          <br /><br />
          <Alert
            message={
              <>
                รหัสร้านของคุณ:{' '}
                <strong style={{ fontSize: 24, letterSpacing: 6, fontFamily: 'monospace' }}>
                  {done.refCode}
                </strong>
              </>
            }
            description="📌 บันทึกรหัสนี้ไว้ — จำเป็นสำหรับการ Login ทุกครั้ง"
            type="warning"
            showIcon
            style={{ marginBottom: 24, textAlign: 'left' }}
          />
          <Button type="primary" size="large" onClick={() => router.push('/login')}>
            ไปหน้า Login
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f1f5f9' }}>
      <Card style={{ width: 480 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 4 }}>
          🔧 ตั้งค่าระบบครั้งแรก
        </Title>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
          สร้างร้านและผู้ดูแลระบบ (Super Admin)
        </Text>

        {error && (
          <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
        )}

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="ชื่อร้าน"
            name="shopName"
            rules={[{ required: true, message: 'กรุณากรอกชื่อร้าน' }]}
          >
            <Input placeholder="เช่น ดีดีช่างยนต์" size="large" />
          </Form.Item>

          <Form.Item
            label="ชื่อ Admin"
            name="adminName"
            rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}
          >
            <Input placeholder="ชื่อ-นามสกุล" size="large" />
          </Form.Item>

          <Form.Item
            label="Email"
            name="adminEmail"
            rules={[{ required: true, type: 'email', message: 'กรุณากรอก Email ที่ถูกต้อง' }]}
          >
            <Input placeholder="admin@example.com" size="large" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="adminPassword"
            rules={[{ required: true, min: 8, message: 'Password ต้องมีอย่างน้อย 8 ตัวอักษร' }]}
          >
            <Input.Password placeholder="อย่างน้อย 8 ตัวอักษร" size="large" />
          </Form.Item>

          <Form.Item
            label="ยืนยัน Password"
            name="confirmPassword"
            dependencies={['adminPassword']}
            rules={[
              { required: true, message: 'กรุณายืนยัน Password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('adminPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Password ไม่ตรงกัน'))
                },
              }),
            ]}
          >
            <Input.Password size="large" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading} block size="large">
            สร้างระบบ
          </Button>
        </Form>
      </Card>
    </div>
  )
}
