import { Mail, Phone, MapPin, Clock } from 'lucide-react'

export const metadata = { title: 'ติดต่อ — ดีดีช่างยนต์' }

const INFO = [
  { icon: <Mail size={20} color="#2563eb" />, label: 'อีเมล', value: 'support@ddcar.th' },
  { icon: <Phone size={20} color="#2563eb" />, label: 'โทรศัพท์', value: '02-XXX-XXXX' },
  { icon: <MapPin size={20} color="#2563eb" />, label: 'ที่อยู่', value: 'กรุงเทพมหานคร, ประเทศไทย' },
  { icon: <Clock size={20} color="#2563eb" />, label: 'เวลาทำการ', value: 'จันทร์–ศุกร์ 09:00–18:00 น.' },
]

export default function ContactPage() {
  return (
    <main style={{ background: '#f8fafc', minHeight: '80vh' }}>
      <section style={{ background: 'linear-gradient(135deg, #1e293b, #1e3a5f)', color: 'white', padding: '60px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 700, marginBottom: 12 }}>ติดต่อเรา</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem' }}>
          มีคำถามหรือต้องการสาธิตระบบ ทีมงานพร้อมช่วยเหลือ
        </p>
      </section>

      <section style={{ maxWidth: 800, margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
          {/* Contact info */}
          <div style={{ background: 'white', borderRadius: 16, padding: '36px 32px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', marginBottom: 24 }}>ข้อมูลการติดต่อ</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {INFO.map(({ icon, label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
                    <div style={{ color: '#1e293b', fontWeight: 500 }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div style={{ background: 'white', borderRadius: 16, padding: '36px 32px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>ลิงก์ที่เป็นประโยชน์</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'คู่มือการใช้งาน', href: '#' },
                { label: 'คำถามที่พบบ่อย (FAQ)', href: '#' },
                { label: 'นโยบายความเป็นส่วนตัว', href: '/privacy' },
                { label: 'ข้อกำหนดการใช้บริการ', href: '/terms' },
              ].map(({ label, href }) => (
                <a key={label} href={href} style={{
                  display: 'block',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  borderRadius: 8,
                  color: '#2563eb',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  border: '1px solid #e2e8f0',
                }}>
                  {label} →
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
