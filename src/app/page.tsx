'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Form, Steps, Button, Input, DatePicker, TimePicker,
  InputNumber, Select, Checkbox, Upload, message, Card, Typography
} from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Dragger } = Upload
const { Title } = Typography

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

// Fields required per step (empty = no required fields to validate)
const STEP_REQUIRED_FIELDS: string[][] = [
  ['date', 'time'],
  ['customerName', 'phone', 'licensePlate', 'odometer'],
  [],
  ['cause', 'totalPrice', 'status'],
  [],
]

export default function IntakeFormPage() {
  const router = useRouter()
  const [form]        = Form.useForm()
  const [step, setStep]       = useState(0)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [loading, setLoading]   = useState(false)

  const goNext = async () => {
    try {
      if (STEP_REQUIRED_FIELDS[step].length > 0) {
        await form.validateFields(STEP_REQUIRED_FIELDS[step])
      }
      setStep(s => s + 1)
    } catch { /* validation error shown by Ant Design */ }
  }

  const goPrev = () => setStep(s => s - 1)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const values = form.getFieldsValue(true)

      const body = {
        date:        (values.date as dayjs.Dayjs)?.format('YYYY-MM-DD') ?? '',
        time:        (values.time as dayjs.Dayjs)?.format('HH:mm') ?? '',
        customerName: values.customerName ?? '',
        phone:        values.phone ?? '',
        licensePlate: values.licensePlate ?? '',
        odometer:     Number(values.odometer ?? 0),
        symptoms:     Array.isArray(values.symptoms) ? values.symptoms : [],
        notes:        values.notes ?? '',
        cause:        values.cause ?? '',
        totalPrice:   Number(values.totalPrice ?? 0),
        status:       values.status ?? STATUSES[0],
      }

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to save job')
      }

      const { id } = await res.json()

      // Upload images if any were selected
      if (fileList.length > 0) {
        const fd = new FormData()
        fileList.forEach(f => {
          if (f.originFileObj) fd.append('images', f.originFileObj)
        })
        const imgRes = await fetch(`/api/jobs/${id}/images`, { method: 'POST', body: fd })
        if (!imgRes.ok) {
          message.warning('บันทึกงานแล้ว แต่อัปโหลดรูปภาพไม่สำเร็จ')
        }
      }

      router.push(`/receipt/${id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const stepLabel = (n: number) =>
    ['1. เบื้องต้น','2. ลูกค้า/รถ','3. อาการ','4. ผลและราคา','5. รูปภาพ'][n]

  return (
    <div style={{ minHeight: 'calc(100vh - 48px)', background: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '32px 16px' }}>
      <Card style={{ width: '100%', maxWidth: 520, borderRadius: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.06)' }}>

        {/* Progress steps */}
        <Steps
          current={step}
          size="small"
          style={{ marginBottom: 28 }}
          items={[
            { title: 'เบื้องต้น' },
            { title: 'ลูกค้า/รถ' },
            { title: 'อาการ' },
            { title: 'ผล/ราคา' },
            { title: 'รูปภาพ' },
          ]}
        />

        <Form form={form} layout="vertical" requiredMark={false}>

          {/* ── Step 1: Basic Info ───────────────────────────── */}
          <div style={{ display: step === 0 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 20 }}>
              {stepLabel(0)}
            </Title>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="date" label="วันที่รับรถ" rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}>
                <DatePicker style={{ width: '100%' }} placeholder="เลือกวันที่" />
              </Form.Item>
              <Form.Item name="time" label="เวลา" rules={[{ required: true, message: 'กรุณาเลือกเวลา' }]}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" placeholder="เลือกเวลา" />
              </Form.Item>
            </div>
          </div>

          {/* ── Step 2: Customer & Vehicle ───────────────────── */}
          <div style={{ display: step === 1 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 20 }}>
              {stepLabel(1)}
            </Title>
            <Form.Item name="customerName" label="ชื่อ-นามสกุล ลูกค้า" rules={[{ required: true, message: 'กรุณาระบุชื่อ' }]}>
              <Input placeholder="ระบุชื่อ-นามสกุล" />
            </Form.Item>
            <Form.Item name="phone" label="เบอร์โทรศัพท์ (สำคัญมาก)" rules={[{ required: true, message: 'กรุณาระบุเบอร์โทร' }]}>
              <Input placeholder="08X-XXX-XXXX" />
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="licensePlate" label="ทะเบียนรถ" rules={[{ required: true, message: 'กรุณาระบุทะเบียน' }]}>
                <Input placeholder="กข 1234" />
              </Form.Item>
              <Form.Item name="odometer" label="เลขไมล์ (KM)" rules={[{ required: true, message: 'กรุณาระบุเลขไมล์' }]}>
                <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
              </Form.Item>
            </div>
          </div>

          {/* ── Step 3: Symptoms ─────────────────────────────── */}
          <div style={{ display: step === 2 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 20 }}>
              {stepLabel(2)}
            </Title>
            <Form.Item name="symptoms" label="เลือกระบบที่มีปัญหา">
              <Checkbox.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SYMPTOMS.map(s => (
                  <Checkbox
                    key={s}
                    value={s}
                    style={{
                      background: '#f1f5f9',
                      padding: '10px 14px',
                      borderRadius: 8,
                      marginInlineStart: 0,
                      width: '100%',
                    }}
                  >
                    {s}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </Form.Item>
            <Form.Item name="notes" label="รายละเอียดเพิ่มเติม">
              <TextArea rows={2} placeholder="อาการอื่น ๆ ที่ลูกค้าแจ้ง" />
            </Form.Item>
            <div style={{
              background: '#fff7ed',
              border: '1px dashed #f97316',
              padding: '12px 16px',
              borderRadius: 8,
              fontSize: '0.875rem',
              color: '#9a3412',
              fontStyle: 'italic',
            }}>
              <strong>ธุรการพูด:</strong> "เดี๋ยวช่างนัทจะเช็คอย่างละเอียดและโทรแจ้งราคาก่อนซ่อมนะคะ"
            </div>
          </div>

          {/* ── Step 4: Result & Price ───────────────────────── */}
          <div style={{ display: step === 3 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 20 }}>
              {stepLabel(3)}
            </Title>
            <Form.Item name="cause" label="สาเหตุที่พบ / อะไหล่" rules={[{ required: true, message: 'กรุณาระบุสาเหตุ' }]}>
              <TextArea rows={3} placeholder="เช่น ผ้าเบรคหมด, น้ำมันเครื่องรั่ว" />
            </Form.Item>
            <Form.Item name="totalPrice" label="สรุปราคาสุทธิ (บาท)" rules={[{ required: true, message: 'กรุณาระบุราคา' }]}>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="0.00" />
            </Form.Item>
            <Form.Item name="status" label="สถานะ" initialValue={STATUSES[0]} rules={[{ required: true }]}>
              <Select options={STATUSES.map(s => ({ label: s, value: s }))} />
            </Form.Item>
          </div>

          {/* ── Step 5: Image Upload ─────────────────────────── */}
          <div style={{ display: step === 4 ? 'block' : 'none' }}>
            <Title level={5} style={{ borderLeft: '4px solid #2563eb', paddingLeft: 10, marginBottom: 20 }}>
              {stepLabel(4)}
            </Title>
            <Dragger
              accept=".jpg,.jpeg,.png,.webp"
              maxCount={10}
              fileList={fileList}
              multiple
              onChange={({ fileList: fl }) => setFileList(fl)}
              beforeUpload={() => false}
              listType="picture"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 40, color: '#2563eb' }} />
              </p>
              <p style={{ fontWeight: 600 }}>คลิกหรือลากไฟล์รูปภาพมาวางที่นี่</p>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                รองรับ JPG, PNG, WEBP · สูงสุด 10 รูป · ไม่เกิน 5 MB/รูป (ไม่บังคับ)
              </p>
            </Dragger>
          </div>
        </Form>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
          {step > 0 ? (
            <Button onClick={goPrev} disabled={loading}>กลับ</Button>
          ) : (
            <div />
          )}
          {step < 4 ? (
            <Button type="primary" onClick={goNext}>ถัดไป →</Button>
          ) : (
            <Button
              type="primary"
              style={{ background: '#10b981', borderColor: '#10b981' }}
              onClick={handleSubmit}
              loading={loading}
            >
              บันทึกงาน ✓
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
