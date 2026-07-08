import { Target, Heart, Zap } from 'lucide-react'

export const metadata = { title: 'เกี่ยวกับเรา — ดีดีช่างยนต์' }

export default function AboutPage() {
  return (
    <main style={{ background: '#f8fafc', minHeight: '80vh' }}>
      {/* Header */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b, #1e3a5f)', color: 'white', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, marginBottom: 12 }}>เกี่ยวกับดีดีช่างยนต์</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem', lineHeight: 1.7 }}>
            เราสร้างเครื่องมือที่ทำให้ช่างไทยทำงานได้ง่ายขึ้น มีระบบมากขึ้น และมีรายได้ที่มั่นคงขึ้น
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 900, margin: '0 auto', padding: '64px 24px' }}>
        {/* Story */}
        <div style={{ background: 'white', borderRadius: 16, padding: '40px 48px', marginBottom: 32, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>เราเป็นใคร</h2>
          <p style={{ color: '#475569', lineHeight: 1.8, fontSize: '1rem' }}>
            ดีดีช่างยนต์เกิดจากความต้องการแก้ปัญหาของอู่ซ่อมรถที่ยังต้องพึ่งพากระดาษและสมุดบันทึก
            เราเชื่อว่าช่างฝีมือดีควรมีเครื่องมือดิจิทัลที่ทันสมัยเช่นกัน ระบบของเราออกแบบให้ใช้งานง่าย
            รองรับทั้งอู่เล็กและอู่กลาง โดยไม่ต้องมีทีม IT ดูแล
          </p>
        </div>

        {/* Values */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {[
            { icon: <Target size={28} color="#2563eb" />, title: 'พันธกิจ', desc: 'ยกระดับการบริหารอู่ซ่อมรถไทยให้เป็นดิจิทัล ลดต้นทุน เพิ่มประสิทธิภาพ' },
            { icon: <Heart size={28} color="#e11d48" />, title: 'คุณค่าของเรา', desc: 'ใส่ใจผู้ใช้งานจริง ฟังความต้องการของช่างและเจ้าของอู่ เพื่อพัฒนาระบบตลอดเวลา' },
            { icon: <Zap size={28} color="#f59e0b" />, title: 'วิสัยทัศน์', desc: 'เป็นแพลตฟอร์มที่อู่ซ่อมรถทั่วไทยไว้วางใจมากที่สุด ภายในปี 2027' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ background: 'white', borderRadius: 12, padding: 28, border: '1px solid #e2e8f0' }}>
              <div style={{ marginBottom: 12 }}>{icon}</div>
              <h3 style={{ fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>{title}</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
