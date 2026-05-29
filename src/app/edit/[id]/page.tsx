'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Form, Input, InputNumber, Select, Checkbox,
  DatePicker, TimePicker, Button, Typography,
  Space, Divider, message, Spin, Card,
} from 'antd'
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const { Title } = Typography
const { TextArea } = Input

const SYMPTOMS = [
  'ระบบเครื่องยนต์',
  'ระบบส่งกำลัง',
  'ระบบช่วงล่าง',
  'ระบบปรับอากาศ',
  'ระบบเบรค',
]

const STATUSES = [
  'ลูกค้าอนุมัติซ่อมแล้ว',
  'ซ่อมเสร็จเรียบร้อยแล้ว',
  'ส่งมอบและเก็บเงินแล้ว',
]

export default function EditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [jobNo, setJobNo]       = useState('')

  // Load existing job data
  useEffect(() => {
    fetch(`/api/jobs/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('not found')
        return res.json()
      })
      .then(job => {
        setJobNo(job.jobNo)
        form.setFieldsValue({
          date:         dayjs(job.date, 'YYYY-MM-DD'),
          time:         dayjs(job.time, 'HH:mm'),
          customerName: job.customerName,
          phone:        job.phone,
          licensePlate: job.licensePlate,
          odometer:     job.odometer,
          symptoms:     job.symptoms,
          notes:        job.notes ?? '',
          cause:        job.cause,
          totalPrice:   job.totalPrice,
          status:       job.status,
        })
      })
      .catch(() => message.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [id, form])

  const onFinish = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      const payload = {
        date:         (values.date as dayjs.Dayjs).format('YYYY-MM-DD'),
        time:         (values.time as dayjs.Dayjs).format('HH:mm'),
        customerName: values.customerName,
        phone:        values.phone,
        licensePlate: values.licensePlate,
        odometer:     values.odometer,
        symptoms:     values.symptoms ?? [],
        notes:        values.notes || null,
        cause:        values.cause,
        totalPrice:   values.totalPrice,
        status:       values.status,
      }

      const res = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('save failed')

      message.success('บันทึกเรียบร้อยแล้ว')
      router.push(`/receipt/${id}`)
    } catch {
      message.error('บันทึกไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>กลับ</Button>
      </Space>

      <Card>
        <Title level={4} style={{ marginBottom: 4 }}>✏️ แก้ไขใบงาน</Title>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          เลขที่ใบงาน: <strong>{jobNo}</strong>
        </Typography.Text>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
        >
          {/* ── Section 1: Basic Info ── */}
          <Divider orientation="left" style={{ fontWeight: 600 }}>ข้อมูลเบื้องต้น</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="date" label="วันที่รับรถ" rules={[{ required: true, message: 'กรุณาระบุวันที่' }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="time" label="เวลา" rules={[{ required: true, message: 'กรุณาระบุเวลา' }]}>
              <TimePicker style={{ width: '100%' }} format="HH:mm" />
            </Form.Item>
          </div>

          {/* ── Section 2: Customer & Vehicle ── */}
          <Divider orientation="left" style={{ fontWeight: 600 }}>ข้อมูลลูกค้าและรถ</Divider>
          <Form.Item name="customerName" label="ชื่อ-นามสกุล" rules={[{ required: true, message: 'กรุณาระบุชื่อ' }]}>
            <Input placeholder="ระบุชื่อ-นามสกุล" />
          </Form.Item>
          <Form.Item name="phone" label="เบอร์โทรศัพท์" rules={[{ required: true, message: 'กรุณาระบุเบอร์โทร' }]}>
            <Input placeholder="08X-XXX-XXXX" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="licensePlate" label="ทะเบียนรถ" rules={[{ required: true, message: 'กรุณาระบุทะเบียน' }]}>
              <Input placeholder="กข 1234" />
            </Form.Item>
            <Form.Item name="odometer" label="เลขไมล์ (KM)" rules={[{ required: true, message: 'กรุณาระบุเลขไมล์' }]}>
              <InputNumber style={{ width: '100%' }} min={0} placeholder="85000" />
            </Form.Item>
          </div>

          {/* ── Section 3: Symptoms ── */}
          <Divider orientation="left" style={{ fontWeight: 600 }}>อาการที่แจ้ง</Divider>
          <Form.Item name="symptoms" label="อาการ">
            <Checkbox.Group options={SYMPTOMS} style={{ display: 'flex', flexDirection: 'column', gap: 8 }} />
          </Form.Item>
          <Form.Item name="notes" label="รายละเอียดเพิ่มเติม">
            <TextArea rows={2} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" />
          </Form.Item>

          {/* ── Section 4: Result & Price ── */}
          <Divider orientation="left" style={{ fontWeight: 600 }}>บันทึกผลและราคา</Divider>
          <Form.Item name="cause" label="สาเหตุที่พบ / อะไหล่" rules={[{ required: true, message: 'กรุณาระบุสาเหตุ' }]}>
            <TextArea rows={3} placeholder="ระบุสาเหตุและอะไหล่ที่ใช้" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="totalPrice" label="สรุปราคาสุทธิ (บาท)" rules={[{ required: true, message: 'กรุณาระบุราคา' }]}>
              <InputNumber style={{ width: '100%' }} min={0} placeholder="0.00" />
            </Form.Item>
            <Form.Item name="status" label="สถานะ" rules={[{ required: true, message: 'กรุณาเลือกสถานะ' }]}>
              <Select options={STATUSES.map(s => ({ label: s, value: s }))} />
            </Form.Item>
          </div>

          {/* ── Actions ── */}
          <Divider />
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
                size="large"
              >
                บันทึกการแก้ไข
              </Button>
              <Button size="large" onClick={() => router.push(`/receipt/${id}`)}>
                ยกเลิก
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
