import { buildNotificationMessage } from '@/lib/notificationUtils'

describe('buildNotificationMessage', () => {
  it('formats job_created message', () => {
    const msg = buildNotificationMessage('job_created', 'JB-001', 'กข-1234')
    expect(msg).toBe('งานใหม่ JB-001 · กข-1234')
  })

  it('formats job_status_changed message', () => {
    const msg = buildNotificationMessage('job_status_changed', 'JB-001', undefined, 'ซ่อมเสร็จแล้ว')
    expect(msg).toBe('สถานะเปลี่ยน JB-001 → ซ่อมเสร็จแล้ว')
  })
})
