'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Form, Input, InputNumber, Select, Checkbox,
  DatePicker, TimePicker, Button, Typography,
  Space, Divider, message, Spin, Card, Tag, Alert,
} from 'antd'
import { SaveOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { ArrowDownToLine, Pencil } from 'lucide-react'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input

const SYMPTOMS = [
  'ระบบเครื่องยนต์', 'ระบบส่งกำลัง', 'ระบบช่วงล่าง', 'ระบบปรับอากาศ', 'ระบบเบรค',
]

const STATUSES = [
  'ลูกค้าอนุมัติซ่อมแล้ว',
  'ถ่ายงานออก',
  'อยู่ระหว่างดำเนินการ',
  'ซ่อมเสร็จเรียบร้อยแล้ว',
  'ส่งมอบและเก็บเงินแล้ว',
  'ยกเลิกรายการแล้ว',
]

interface Tech { id: string; name: string }
interface StockItem { id: string; name: string; unit: string; availableQty: number; category: string }
interface PartRow { stockItemId: string; quantity: number; stockItem?: { name: string; unit: string } }

interface EditFormProps {
  isDestinationShop?: boolean
  fromShopName?: string
}

export default function EditForm({ isDestinationShop = false, fromShopName = '' }: EditFormProps) {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [jobNo, setJobNo]       = useState('')
  const [stockStatus, setStockStatus] = useState<string>('none')
  const [techs, setTechs]       = useState<Tech[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [parts, setParts]       = useState<PartRow[]>([])

  useEffect(() => {
    Promise.all([
      fetch(`/api/jobs/${id}`).then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/users/techs').then(r => r.json()),
      fetch('/api/stock?available=true').then(r => r.json()),
    ])
      .then(([job, techList, stockList]) => {
        setJobNo(job.jobNo)
        setStockStatus(job.stockStatus ?? 'none')
        setTechs(techList)
        setStockItems(stockList)
        setParts(job.jobParts ?? [])
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
          assignedTo:   job.assignedTo ?? undefined,
        })
      })
      .catch(() => message.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [id, form])

  function updatePart(index: number, field: keyof PartRow, value: string | number) {
    setParts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  const onFinish = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      const validParts = parts.filter(p => p.stockItemId && p.quantity > 0)
      const payload: Record<string, unknown> = {
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
        assignedTo:   values.assignedTo || null,
      }

      // Only send parts if still editable
      if (stockStatus === 'none') {
        payload.parts = validParts.map(p => ({ stockItemId: p.stockItemId, quantity: p.quantity }))
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

  const partsLocked = stockStatus !== 'none'

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>
      {isDestinationShop && fromShopName && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 16px', marginBottom: 16 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowDownToLine size={15} /> รับโอนจาก <strong>{fromShopName}</strong> — แก้ไขได้เฉพาะสถานะและอะไหล่</span>
        </div>
      )}
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>กลับ</Button>
      </Space>

      <Card>
        <Title level={4} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><Pencil size={18} /> แก้ไขใบงาน</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          เลขที่ใบงาน: <strong>{jobNo}</strong>
        </Text>

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Divider orientation="left" style={{ fontWeight: 600 }}>ข้อมูลเบื้องต้น</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="date" label="วันที่รับรถ" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" disabled={isDestinationShop} />
            </Form.Item>
            <Form.Item name="time" label="เวลา" rules={[{ required: true }]}>
              <TimePicker style={{ width: '100%' }} format="HH:mm" disabled={isDestinationShop} />
            </Form.Item>
          </div>
          <Form.Item name="assignedTo" label="ช่างที่รับงาน">
            <Select
              allowClear
              placeholder="เลือกช่าง"
              options={techs.map(t => ({ label: t.name, value: t.id }))}
              disabled={isDestinationShop}
            />
          </Form.Item>

          <Divider orientation="left" style={{ fontWeight: 600 }}>ข้อมูลลูกค้าและรถ</Divider>
          <Form.Item name="customerName" label="ชื่อ-นามสกุล" rules={[{ required: true }]}>
            <Input disabled={isDestinationShop} />
          </Form.Item>
          <Form.Item name="phone" label="เบอร์โทรศัพท์" rules={[{ required: true }]}>
            <Input disabled={isDestinationShop} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="licensePlate" label="ทะเบียนรถ" rules={[{ required: true }]}>
              <Input disabled={isDestinationShop} />
            </Form.Item>
            <Form.Item name="odometer" label="เลขไมล์ (KM)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} disabled={isDestinationShop} />
            </Form.Item>
          </div>

          <Divider orientation="left" style={{ fontWeight: 600 }}>อาการที่แจ้ง</Divider>
          <Form.Item name="symptoms" label="อาการ">
            <Checkbox.Group options={SYMPTOMS} style={{ display: 'flex', flexDirection: 'column', gap: 8 }} disabled={isDestinationShop} />
          </Form.Item>
          <Form.Item name="notes" label="รายละเอียดเพิ่มเติม">
            <TextArea rows={2} disabled={isDestinationShop} />
          </Form.Item>

          <Divider orientation="left" style={{ fontWeight: 600 }}>บันทึกผลและราคา</Divider>
          <Form.Item name="cause" label="สาเหตุที่พบ / อะไหล่" rules={[{ required: true }]}>
            <TextArea rows={3} disabled={isDestinationShop} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="totalPrice" label="สรุปราคาสุทธิ (บาท)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} disabled={isDestinationShop} />
            </Form.Item>
            <Form.Item name="status" label="สถานะ" rules={[{ required: true }]}>
              <Select options={STATUSES.map(s => ({ label: s, value: s }))} />
            </Form.Item>
          </div>

          <Divider orientation="left" style={{ fontWeight: 600 }}>
            อะไหล่
            {partsLocked && (
              <Tag color="orange" style={{ marginLeft: 8, fontWeight: 400 }}>
                ล็อค — stockStatus: {stockStatus}
              </Tag>
            )}
          </Divider>
          {partsLocked ? (
            parts.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                {parts.map((p, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    {p.stockItem?.name ?? p.stockItemId} × {p.quantity} {p.stockItem?.unit ?? ''}
                  </div>
                ))}
              </div>
            ) : (
              <Alert message="ไม่มีอะไหล่ในงานนี้" type="info" style={{ marginBottom: 16 }} />
            )
          ) : (
            <>
              {parts.map((part, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 32px', gap: 8, marginBottom: 8 }}>
                  <Select
                    placeholder="เลือกอะไหล่"
                    value={part.stockItemId || undefined}
                    onChange={v => updatePart(index, 'stockItemId', v)}
                    options={stockItems.map(s => ({
                      label: `${s.name} (${s.category}) — พร้อมใช้ ${s.availableQty} ${s.unit}`,
                      value: s.id,
                    }))}
                  />
                  <InputNumber
                    min={1}
                    value={part.quantity}
                    onChange={v => updatePart(index, 'quantity', v ?? 1)}
                    style={{ width: '100%' }}
                  />
                  <Button danger icon={<DeleteOutlined />} onClick={() => setParts(prev => prev.filter((_, i) => i !== index))} />
                </div>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => setParts(prev => [...prev, { stockItemId: '', quantity: 1 }])}
                style={{ marginBottom: 16 }}
                block
              >
                เพิ่มอะไหล่
              </Button>
            </>
          )}

          <Divider />
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large">
                บันทึกการแก้ไข
              </Button>
              <Button size="large" onClick={() => router.push(`/receipt/${id}`)}>ยกเลิก</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
