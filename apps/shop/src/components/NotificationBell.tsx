'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge, Dropdown, Button, Typography } from 'antd'
import { Bell, FileText, RefreshCw } from 'lucide-react'
import { useSSE } from '@/hooks/useSSE'

interface NotificationItem {
  id: string
  type: string
  message: string
  isRead: boolean
  createdAt: string
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'เมื่อกี้'
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`
  return `${Math.floor(diff / 86400)} วันที่แล้ว`
}

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=10')
      if (!res.ok) return
      const data = await res.json()
      setItems(data.items)
      setUnreadCount(data.unreadCount)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  useSSE((event) => {
    if (event.type === 'job_created' || event.type === 'job_status_changed') {
      fetchNotifications()
    }
  })

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' })
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  const markOneRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const dropdownContent = (
    <div style={{ width: 280, background: 'white', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Text strong>การแจ้งเตือน</Typography.Text>
        {unreadCount > 0 && (
          <Button type="link" size="small" style={{ padding: 0, fontSize: 11 }} onClick={markAllRead}>
            อ่านทั้งหมด
          </Button>
        )}
      </div>

      {items.length === 0 && (
        <div style={{ padding: '16px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
          ไม่มีการแจ้งเตือน
        </div>
      )}

      {items.map(n => (
        <div
          key={n.id}
          onClick={() => !n.isRead && markOneRead(n.id)}
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid #f1f5f9',
            background: n.isRead ? 'white' : '#eff6ff',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            cursor: n.isRead ? 'default' : 'pointer',
            opacity: n.isRead ? 0.55 : 1,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: n.isRead ? '#cbd5e1' : '#2563eb', marginTop: 5, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: n.isRead ? 400 : 600, color: n.isRead ? '#475569' : '#1e293b' }}>
              {n.type === 'job_created'
                ? <FileText size={11} />
                : <RefreshCw size={11} />
              }
              {n.message}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{timeAgo(n.createdAt)}</div>
          </div>
        </div>
      ))}

      <div style={{ padding: '6px 12px', textAlign: 'center' }}>
        <Button type="link" size="small" style={{ fontSize: 11 }} href="/report">
          ดูทั้งหมดในรายงาน
        </Button>
      </div>
    </div>
  )

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<Bell size={16} />}
          style={{ color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center' }}
        />
      </Badge>
    </Dropdown>
  )
}
