'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, Typography, Alert, Checkbox, DatePicker, Divider } from 'antd'
import Link from 'next/link'
import { Wrench } from 'lucide-react'
import type { Dayjs } from 'dayjs'

const { Title, Text } = Typography

interface FormValues {
  firstName: string
  lastName: string
  shopName: string
  email: string
  password: string
  confirmPassword: string
  phone: string
  birthDate: Dayjs
  acceptPrivacy: boolean
  acceptTerms: boolean
}

export default function RegisterForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form] = Form.useForm<FormValues>()

  async function onFinish(values: FormValues) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          shopName: values.shopName,
          email: values.email,
          password: values.password,
          phone: values.phone,
          birthDate: values.birthDate.format('YYYY-MM-DD'),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }

      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        refCode: '',
        redirect: false,
      })
      if (result?.error) {
        setError('สมัครสมาชิกสำเร็จ แต่เข้าสู่ระบบไม่ได้ กรุณา Login ใหม่')
        router.push('/login')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ width: 480, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <Wrench size={28} color="#2563eb" />
        </div>
        <Title level={3} style={{ margin: 0 }}>สมัครสมาชิก</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>สร้างร้านและบัญชีผู้ดูแลระบบ</Text>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item label="ชื่อ" name="firstName" rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item label="นามสกุล" name="lastName" rules={[{ required: true, message: 'กรุณากรอกนามสกุล' }]}>
            <Input size="large" />
          </Form.Item>
        </div>

        <Form.Item label="ชื่อร้าน" name="shopName" rules={[{ required: true, message: 'กรุณากรอกชื่อร้าน' }]}>
          <Input size="large" placeholder="เช่น ดีดีช่างยนต์" />
        </Form.Item>

        <Form.Item label="อีเมล" name="email" rules={[{ required: true, type: 'email', message: 'กรุณากรอก Email ที่ถูกต้อง' }]}>
          <Input size="large" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item label="รหัสผ่าน" name="password" rules={[{ required: true, min: 8, message: 'อย่างน้อย 8 ตัวอักษร' }]}>
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item
            label="ยืนยันรหัสผ่าน"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: 'กรุณายืนยัน Password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve()
                  return Promise.reject(new Error('รหัสผ่านไม่ตรงกัน'))
                },
              }),
            ]}
          >
            <Input.Password size="large" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item label="เบอร์โทร" name="phone" rules={[{ required: true, message: 'กรุณากรอกเบอร์โทร' }]}>
            <Input size="large" maxLength={10} />
          </Form.Item>
          <Form.Item label="วันเกิด" name="birthDate" rules={[{ required: true, message: 'กรุณาเลือกวันเกิด' }]}>
            <DatePicker size="large" style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>

        <Form.Item
          name="acceptPrivacy"
          valuePropName="checked"
          rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject(new Error('กรุณายอมรับ Privacy Policy')) }]}
        >
          <Checkbox>
            ยอมรับ <Link href="/privacy" target="_blank">Privacy Policy</Link>
          </Checkbox>
        </Form.Item>

        <Form.Item
          name="acceptTerms"
          valuePropName="checked"
          rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject(new Error('กรุณายอมรับ Terms of Service')) }]}
          style={{ marginBottom: 20 }}
        >
          <Checkbox>
            ยอมรับ <Link href="/terms" target="_blank">Terms of Service</Link>
          </Checkbox>
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={loading} block size="large">
          สมัครสมาชิก
        </Button>
      </Form>

      <Divider style={{ margin: '20px 0' }} />
      <div style={{ textAlign: 'center' }}>
        <Text type="secondary">มีบัญชีแล้ว? </Text>
        <Link href="/login">เข้าสู่ระบบ</Link>
      </div>
    </Card>
  )
}
