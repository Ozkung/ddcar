import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Descriptions, Tag, Image, Typography, Divider } from 'antd'
import PrintButton from './PrintButton'

const { Title, Text } = Typography

const STATUS_COLORS: Record<string, string> = {
  'ลูกค้าอนุมัติซ่อมแล้ว':  'blue',
  'ซ่อมเสร็จเรียบร้อยแล้ว': 'orange',
  'ส่งมอบและเก็บเงินแล้ว':  'green',
}

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: { images: true },
  })

  if (!job) notFound()

  const items = [
    { key: '1',  label: 'เลขที่ใบงาน',          children: <Text strong>{job.jobNo}</Text> },
    { key: '2',  label: 'วันที่รับรถ',           children: job.date },
    { key: '3',  label: 'เวลา',                  children: job.time },
    { key: '4',  label: 'ชื่อ-นามสกุล',         children: job.customerName },
    { key: '5',  label: 'เบอร์โทรศัพท์',        children: job.phone },
    { key: '6',  label: 'ทะเบียนรถ',            children: job.licensePlate },
    { key: '7',  label: 'เลขไมล์ (KM)',         children: job.odometer.toLocaleString('th-TH') },
    { key: '8',  label: 'อาการที่แจ้ง',          children: job.symptoms.length > 0 ? job.symptoms.join(', ') : '—' },
    { key: '9',  label: 'รายละเอียดเพิ่มเติม',  children: job.notes || '—' },
    { key: '10', label: 'สาเหตุ / อะไหล่',      children: job.cause },
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

      {/* Print button — hidden when printing via globals.css .no-print */}
      <div className="no-print" style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
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
          <Image.PreviewGroup>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {job.images.map(img => (
                <Image
                  key={img.id}
                  src={`/api/uploads/${job.id}/${img.filename}`}
                  width={120}
                  height={120}
                  style={{ objectFit: 'cover', borderRadius: 8 }}
                  alt={img.filename}
                />
              ))}
            </div>
          </Image.PreviewGroup>
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
