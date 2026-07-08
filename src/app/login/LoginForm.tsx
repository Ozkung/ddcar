'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, Typography, Alert, Divider, Tag } from 'antd'
import Link from 'next/link'
import { Wrench } from 'lucide-react'

const { Title, Text } = Typography
const LS_KEY = 'ddcar:recent_refcodes'

export default function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [savedCodes, setSavedCodes] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setSavedCodes(Array.isArray(parsed) ? parsed : [])
      }
    } catch {}
  }, [])

  function saveRefCode(code: string) {
    const updated = [code, ...savedCodes.filter(c => c !== code)].slice(0, 5)
    setSavedCodes(updated)
    localStorage.setItem(LS_KEY, JSON.stringify(updated))
  }

  function removeRefCode(code: string) {
    const updated = savedCodes.filter(c => c !== code)
    setSavedCodes(updated)
    localStorage.setItem(LS_KEY, JSON.stringify(updated))
  }

  async function onLogin({ email, password, refCode }: { email: string; password: string; refCode?: string }) {
    setLoading(true)
    setError(null)
    const result = await signIn('credentials', {
      email,
      password,
      refCode: refCode ?? '',
      redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError('Email, Password หรือรหัสร้านไม่ถูกต้อง')
    } else {
      if (refCode) saveRefCode(refCode)
      router.push('/')
      router.refresh()
    }
  }

  return (
    <Card style={{ width: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <Wrench size={32} color="#2563eb" />
        </div>
        <Title level={3} style={{ margin: 0 }}>DDReport</Title>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Form form={form} layout="vertical" onFinish={onLogin}>
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

        <Form.Item
          label={
            <span>
              รหัสร้าน{' '}
              <Text type="secondary" style={{ fontSize: 12 }}>(สำหรับช่างหรือพนักงาน)</Text>
            </span>
          }
          name="refCode"
        >
          <Input
            placeholder="เช่น A3K9M"
            maxLength={5}
            size="large"
            style={{ textTransform: 'uppercase', letterSpacing: 4, fontFamily: 'monospace' }}
            onChange={e => form.setFieldValue('refCode', e.target.value.toUpperCase())}
          />
        </Form.Item>

        {savedCodes.length > 0 && (
          <div style={{ marginTop: -8, marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
              ร้านที่เคย Login
            </Text>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {savedCodes.map(code => (
                <Tag
                  key={code}
                  closable
                  style={{ cursor: 'pointer', fontFamily: 'monospace', letterSpacing: 2 }}
                  onClick={() => form.setFieldValue('refCode', code)}
                  onClose={e => { e.stopPropagation(); removeRefCode(code) }}
                >
                  {code}
                </Tag>
              ))}
            </div>
          </div>
        )}

        <Button type="primary" htmlType="submit" loading={loading} block size="large">
          เข้าสู่ระบบ
        </Button>
      </Form>

      <Divider style={{ margin: '20px 0' }} />
      <div style={{ textAlign: 'center' }}>
        <Text type="secondary">ยังไม่มีบัญชี? </Text>
        <Link href="/register">สมัครสมาชิก</Link>
      </div>
    </Card>
  )
}
