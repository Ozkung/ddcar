import Link from 'next/link'
import { Button } from 'antd'
import { Check } from 'lucide-react'

export const metadata = { title: 'ราคา — ดีดีช่างยนต์' }

const PLANS = [
  {
    name: 'Starter',
    price: 'ฟรี',
    sub: 'ตลอดไป',
    color: '#64748b',
    features: [
      'ผู้ใช้สูงสุด 2 คน',
      'บันทึกงานซ่อมไม่จำกัด',
      'รายงานพื้นฐาน',
      'สต็อกอะไหล่สูงสุด 50 รายการ',
    ],
    cta: 'เริ่มใช้ฟรี',
    href: '/register',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '990',
    sub: 'บาท / เดือน',
    color: '#2563eb',
    features: [
      'ผู้ใช้ไม่จำกัด',
      'บันทึกงานซ่อมไม่จำกัด',
      'วิเคราะห์ข้อมูลเชิงลึก',
      'สต็อกอะไหล่ไม่จำกัด',
      'รองรับหลายสาขา',
      'ส่งออก PDF / Excel',
    ],
    cta: 'เริ่มทดลอง 30 วัน',
    href: '/register',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'ติดต่อเรา',
    sub: 'สำหรับเครือข่ายอู่',
    color: '#1e293b',
    features: [
      'ทุกฟีเจอร์ใน Pro',
      'SLA รับประกัน 99.9%',
      'ทีม Support ส่วนตัว',
      'ปรับแต่งตามความต้องการ',
      'ติดตั้งบน Server ตัวเอง',
    ],
    cta: 'ติดต่อทีมงาน',
    href: '/contact',
    highlight: false,
  },
]

export default function PricePage() {
  return (
    <main style={{ background: '#f8fafc', minHeight: '80vh' }}>
      <section style={{ background: 'linear-gradient(135deg, #1e293b, #1e3a5f)', color: 'white', padding: '60px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 700, marginBottom: 12 }}>แผนราคา</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem' }}>
          เริ่มต้นฟรี อัปเกรดเมื่อธุรกิจโต ไม่มีค่าธรรมเนียมซ่อนเร้น
        </p>
      </section>

      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'stretch' }}>
          {PLANS.map(plan => (
            <div key={plan.name} style={{
              background: 'white',
              borderRadius: 16,
              padding: 32,
              border: plan.highlight ? `2px solid ${plan.color}` : '1px solid #e2e8f0',
              boxShadow: plan.highlight ? '0 8px 32px rgba(37,99,235,0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}>
              {plan.highlight && (
                <div style={{
                  position: 'absolute',
                  top: -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#2563eb',
                  color: 'white',
                  borderRadius: 999,
                  padding: '2px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  แนะนำ
                </div>
              )}
              <div style={{ color: plan.color, fontWeight: 700, fontSize: '0.95rem', marginBottom: 8 }}>{plan.name}</div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: plan.price.length > 5 ? '1.2rem' : '2.4rem', fontWeight: 700, color: '#1e293b' }}>{plan.price}</span>
                {' '}
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{plan.sub}</span>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', margin: '20px 0', flex: 1 }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', color: '#475569' }}>
                      <Check size={16} color="#10b981" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <Link href={plan.href} style={{ marginTop: 8 }}>
                <Button
                  type={plan.highlight ? 'primary' : 'default'}
                  size="large"
                  block
                  style={plan.highlight ? {} : { borderColor: plan.color, color: plan.color }}
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
