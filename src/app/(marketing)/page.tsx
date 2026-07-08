import Link from 'next/link'
import { Button } from 'antd'
import {
  ClipboardList, BarChart2, Package, Users, ShieldCheck, Smartphone,
} from 'lucide-react'

const FEATURES = [
  { icon: <ClipboardList size={28} color="#2563eb" />, title: 'รับรถเข้าซ่อม', desc: 'บันทึกงานแบบ Step-by-step ครบทุกขั้นตอนตั้งแต่รับรถจนส่งมอบ' },
  { icon: <BarChart2 size={28} color="#2563eb" />, title: 'วิเคราะห์ข้อมูล', desc: 'ดูสถิติรายได้ ประเภทงานซ่อม และประสิทธิภาพช่างแบบ real-time' },
  { icon: <Package size={28} color="#2563eb" />, title: 'จัดการคลังอะไหล่', desc: 'ติดตามสต็อก แจ้งเตือนของใกล้หมด และบันทึกการใช้งานอะไหล่ต่อชิ้นงาน' },
  { icon: <Users size={28} color="#2563eb" />, title: 'จัดการทีมช่าง', desc: 'กำหนดสิทธิ์ตามตำแหน่ง — หัวหน้าช่าง, ช่าง, แอดมิน แยกชัดเจน' },
  { icon: <ShieldCheck size={28} color="#2563eb" />, title: 'ปลอดภัยสูง', desc: 'ข้อมูลเข้ารหัส ล็อกอินด้วย Email + รหัสร้าน ป้องกันการเข้าถึงโดยไม่ได้รับอนุญาต' },
  { icon: <Smartphone size={28} color="#2563eb" />, title: 'ใช้งานได้ทุกอุปกรณ์', desc: 'รองรับมือถือ แท็บเล็ต และคอมพิวเตอร์ ไม่ต้องติดตั้งแอปเพิ่ม' },
]

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #1e3a5f 100%)',
        color: 'white',
        padding: '80px 24px 100px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(37,99,235,0.2)',
            border: '1px solid rgba(37,99,235,0.4)',
            color: '#93c5fd',
            borderRadius: 999,
            padding: '4px 16px',
            fontSize: 13,
            marginBottom: 24,
          }}>
            ระบบจัดการอู่ซ่อมรถสำหรับช่างไทย
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 700, lineHeight: 1.2, marginBottom: 20 }}>
            บริหารอู่ซ่อมรถ<br />
            <span style={{ color: '#60a5fa' }}>ง่าย เร็ว และมืออาชีพ</span>
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.7)', marginBottom: 36, lineHeight: 1.7 }}>
            ดีดีช่างยนต์ช่วยให้คุณรับรถ บันทึกงาน ติดตามช่าง และดูรายงานได้ในที่เดียว<br />
            ไม่ต้องใช้กระดาษอีกต่อไป
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register">
              <Button type="primary" size="large" style={{ height: 48, paddingInline: 32, fontSize: '1rem' }}>
                ทดลองใช้ฟรี
              </Button>
            </Link>
            <Link href="/price">
              <Button size="large" style={{ height: 48, paddingInline: 32, fontSize: '1rem', background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
                ดูแผนราคา
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '72px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: '1.75rem', fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
            ฟีเจอร์ครบ ใช้ได้จริง
          </h2>
          <p style={{ textAlign: 'center', color: '#64748b', marginBottom: 48, fontSize: '1rem' }}>
            ออกแบบมาเพื่ออู่ซ่อมรถโดยเฉพาะ ตอบโจทย์ทุกกระบวนการ
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 24,
          }}>
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} style={{
                background: 'white',
                borderRadius: 12,
                padding: 28,
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <div style={{ marginBottom: 14 }}>{icon}</div>
                <h3 style={{ fontWeight: 600, fontSize: '1rem', color: '#1e293b', marginBottom: 8 }}>{title}</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        background: '#2563eb',
        color: 'white',
        textAlign: 'center',
        padding: '64px 24px',
      }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 12 }}>
          พร้อมเริ่มต้นแล้วใช่ไหม?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 32, fontSize: '1rem' }}>
          สมัครวันนี้ เปิดร้านพร้อมใช้ทันที ไม่ต้องติดตั้งอะไรเพิ่ม
        </p>
        <Link href="/register">
          <Button size="large" style={{ height: 48, paddingInline: 36, fontSize: '1rem', background: 'white', color: '#2563eb', borderColor: 'white', fontWeight: 600 }}>
            สมัครใช้งานฟรี →
          </Button>
        </Link>
      </section>
    </main>
  )
}
