'use client'

import { Descriptions, Tag, Typography, Divider, Button, Alert, Space } from 'antd'
import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PrintButton from './PrintButton'
import ImageGallery from './ImageGallery'
import Link from 'next/link'
import { EditOutlined } from '@ant-design/icons'
import { Wrench, Clock, ArrowLeftRight, ArrowDownToLine } from 'lucide-react'

const { Title, Text } = Typography

const STATUS_COLORS: Record<string, string> = {
  'ลูกค้าอนุมัติซ่อมแล้ว':  'blue',
  'ซ่อมเสร็จเรียบร้อยแล้ว': 'orange',
  'ส่งมอบและเก็บเงินแล้ว':  'green',
  'ถ่ายงานออก':              'purple',
}

interface TransferInfo {
  id: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
  fromShop: { name: string; refCode: string }
  toShop:   { name: string; refCode: string }
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
  shopId: string | null
  createdAt: string
  images: { id: string; filename: string }[]
  transfer: TransferInfo | null
}

interface Props {
  job: JobData
  currentShopId: string
}

export default function ReceiptContent({ job, currentShopId }: Props) {
  const router = useRouter()
  const transfer = job.transfer

  // Determine perspective
  const isSourceShop = job.shopId === currentShopId
  const isSourcePending  = isSourceShop && transfer?.status === 'PENDING'
  const isSourceAccepted = isSourceShop && transfer?.status === 'ACCEPTED'
  const isDestAccepted   = !isSourceShop && transfer?.status === 'ACCEPTED'

  // 30-second polling + visibilitychange when source is tracking
  const shouldPoll = isSourcePending || isSourceAccepted
  const refresh = useCallback(() => router.refresh(), [router])

  useEffect(() => {
    if (!shouldPoll) return
    const interval = setInterval(refresh, 30_000)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [shouldPoll, refresh])

  async function cancelTransfer() {
    const res = await fetch(`/api/jobs/${job.id}/transfer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    if (res.ok) router.refresh()
  }

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

  // Edit button only shows when job is not actively being transferred
  const showEdit = !transfer || (transfer.status !== 'ACCEPTED' && transfer.status !== 'PENDING')

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>

      {/* Source shop: PENDING — waiting for destination to accept */}
      {isSourcePending && transfer && (
        <Alert
          type="warning"
          style={{ marginBottom: 16 }}
          message={
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clock size={15} /> รอ <strong>{transfer.toShop.name}</strong> กดรับงาน</span>
              <Button size="small" danger onClick={cancelTransfer}>ยกเลิกการโอน</Button>
            </Space>
          }
        />
      )}

      {/* Source shop: ACCEPTED — tracking destination progress */}
      {isSourceAccepted && transfer && (
        <Alert
          type="info"
          style={{ marginBottom: 16 }}
          message={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <ArrowLeftRight size={15} /> ถ่ายงานออกไปยัง <strong>{transfer.toShop.name}</strong>{' '}
              ({transfer.toShop.refCode}) — สถานะปัจจุบัน:{' '}
              <Tag color={STATUS_COLORS[job.status] ?? 'default'}>{job.status}</Tag>
            </span>
          }
        />
      )}

      {/* Destination shop: ACCEPTED */}
      {isDestAccepted && transfer && (
        <Alert
          type="success"
          style={{ marginBottom: 16 }}
          message={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowDownToLine size={15} /> รับโอนจาก <strong>{transfer.fromShop.name}</strong> ({transfer.fromShop.refCode})</span>
          }
        />
      )}

      {/* Action buttons */}
      <div className="no-print" style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {showEdit && (
          <Link href={`/edit/${job.id}`}>
            <Button icon={<EditOutlined />}>แก้ไขใบงาน</Button>
          </Link>
        )}
        <PrintButton />
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Wrench size={22} /> ดีดีช่างยนต์</Title>
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
