'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, Typography, Alert } from 'antd'
import { ShopOutlined, LockOutlined } from '@ant-design/icons'

const { Title } = Typography

export default function LoginForm() {
  const router = useRouter()
  const [step, setStep] = useState<0 | 1>(0)
  const [refCode, setRefCode] = useState('')
  const [shopName, setShopName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form1] = Form.useForm()
  const [form2] = Form.useForm()

  async function onVerifyShop({ code }: { code: string }) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/verify-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refCode: code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setRefCode(code.toUpperCase())
      setShopName(data.shopName)
      setStep(1)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  async function onLogin({ email, password }: { email: string; password: string }) {
    setLoading(true)
    setError(null)
    const result = await signIn('credentials', {
      refCode,
      email,
      password,
      redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError('Email หรือ Password ไม่ถูกต้อง')
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <Card style={{ width: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 32, marginBottom: 4 }}>🔧</div>
        <Title level={3} style={{ margin: 0 }}>DDReport</Title>
      </div>

      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
      )}

      {step === 0 && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 20, color: '#64748b' }}>
            <ShopOutlined style={{ marginRight: 6 }} />
            กรอกรหัสร้านของคุณ
          </div>
          <Form form={form1} layout="vertical" onFinish={onVerifyShop}>
            <Form.Item
              name="code"
              rules={[
                { required: true, message: 'กรุณากรอกรหัสร้าน' },
                { len: 5, message: 'รหัสร้านต้องมี 5 หลัก' },
              ]}
            >
              <Input
                placeholder="เช่น A3K9M"
                maxLength={5}
                size="large"
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: 8,
                  fontSize: 22,
                  textAlign: 'center',
                  fontFamily: 'monospace',
                }}
                onChange={(e) =>
                  form1.setFieldValue('code', e.target.value.toUpperCase())
                }
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              ค้นหาร้าน
            </Button>
          </Form>
        </>
      )}

      {step === 1 && (
        <>
          <Alert
            message={
              <>
                ร้าน:{' '}
                <strong>{shopName}</strong>
                <Button
                  size="small"
                  type="link"
                  style={{ float: 'right', padding: 0 }}
                  onClick={() => {
                    setStep(0)
                    setError(null)
                    form2.resetFields()
                  }}
                >
                  เปลี่ยนร้าน
                </Button>
              </>
            }
            type="success"
            style={{ marginBottom: 20 }}
          />
          <div style={{ textAlign: 'center', marginBottom: 20, color: '#64748b' }}>
            <LockOutlined style={{ marginRight: 6 }} />
            กรอก Email และ Password
          </div>
          <Form form={form2} layout="vertical" onFinish={onLogin}>
            <Form.Item
              label="Email"
              name="email"
              rules={[{ required: true, type: 'email', message: 'กรุณากรอก Email' }]}
            >
              <Input size="large" autoFocus />
            </Form.Item>
            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: 'กรุณากรอก Password' }]}
            >
              <Input.Password size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              เข้าสู่ระบบ
            </Button>
          </Form>
        </>
      )}
    </Card>
  )
}
