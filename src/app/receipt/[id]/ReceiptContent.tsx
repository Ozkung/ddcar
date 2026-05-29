'use client'

import { Descriptions, Tag, Typography, Divider, Button } from 'antd'
import PrintButton from './PrintButton'
import ImageGallery from './ImageGallery'
import Link from 'next/link'
import { EditOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const STATUS_COLORS: Record<string, string> = {
  'ลูกค้าอนุมัติซ่อมแล้ว':  'blue',
  'ซ่อมเสร็จเรียบร้อยแล้ว': 'orange',
  'ส่งมอบและเก็บเงินแล้ว':  'green',
}

interface JobData {
  id: string
  jobNo: string
  date: string
  time: string
  customerName: string
  phone: string
  licensePlate: string
  odometer: number
  symptoms: string[]
  notes: string | null
  cause: string
  totalPrice: number
  status: string
  createdAt: string
  images: { id: string; filename: string }[]
}

export default function ReceiptContent({ job }: { job: JobData }) {
  const items = [
    { key: '1',  label: 'เลขที่ใบงาน',         children: <Text strong>{job.jobNo}</Text> },
    { key: '2',  label: 'วันที่รับรถ',          children: job.date },
    { key: '3',  label: 'เวลา',                 children: job.time },
    { key: '4',  label: 'ชื่อ-นามสกุล',        children: job.customerName },
    { key: '5',  label: 'เบอร์โทรศัพท์',       children: job.phone },
    { key: '6',  label: 'ทะเบียนรถ',           children: job.licensePlate },
    { key: '7',  label: 'เลขไมล์ (KM)',        children: job.odometer.toLocaleString('th-TH') },
    { key: '8',  label: 'อาการที่แจ้ง',         children: job.symptoms.length > 0 ? job.symptoms.join(', ') : '—' },
    { key: '9',  label: 'รายละเอียดเพิ่มเติม', children: job.notes || '—' },
    { key: '10', label: 'สาเหตุ / อะไหล่',     children: job.cause },
    {
      key: '11',
      label: 'ราคาสุทธิ (บาท)',
      children: (
        <Text strong style={{ fontSize: '1.1rem', color: '#10b981' }}>
          {job.totalPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      key: '12',
      label: 'สถานะ',
      children: <Tag color={STATUS_COLORS[job.status] ?? 'default'}>{job.status}</Tag>,
    },
  ]

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>

      {/* Action buttons — hidden when printing via globals.css .no-print */}
      <div className="no-print" style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Link href={`/edit/${job.id}`}>
          <Button icon={<EditOutlined />}>แก้ไขใบงาน</Button>
        </Link>
        <PrintButton />
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>🔧 ดีดีช่างยนต์</Title>
        <Text type="secondary">ใบงานซ่อม</Text>
      </div>

      <Descriptions
        bordered
        column={2}
        items={items}
        size="small"
        labelStyle={{ fontWeight: 600, background: '#f8fafc', width: '140px' }}
      />

      {/* Images */}
      {job.images.length > 0 && (
        <>
          <Divider />
          <Title level={5}>รูปภาพประกอบ</Title>
          <ImageGallery images={job.images} jobId={job.id} />
        </>
      )}

      <Divider />
      <div style={{ textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: '0.8rem' }}>
          บันทึกเมื่อ {new Date(job.createdAt).toLocaleString('th-TH')}
        </Text>
      </div>
    </div>
  )
}
