'use client'

import { useState } from 'react'
import { Tabs, Button } from 'antd'

interface Props {
  appName: string
  companyName: string
  legalEmail: string
  effectiveDate: string
}

export default function PrivacyTabs({ appName, companyName, legalEmail, effectiveDate }: Props) {
  const [lang, setLang] = useState<'th' | 'en'>('th')

  const th = (
    <div style={{ maxWidth: 780, lineHeight: 1.9, fontSize: 15 }}>
      <p><strong>วันที่มีผลบังคับใช้:</strong> {effectiveDate}</p>

      <h2>1. บทนำ</h2>
      <p>
        {companyName} ("บริษัท", "เรา") ให้ความสำคัญกับความเป็นส่วนตัวของท่าน นโยบายนี้อธิบายวิธีที่เราเก็บรวบรวม
        ใช้ และปกป้องข้อมูลส่วนบุคคลของท่านเมื่อท่านใช้งานบริการ {appName} สอดคล้องกับพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
      </p>

      <h2>2. ข้อมูลที่เราเก็บรวบรวม</h2>
      <p><strong>2.1 ข้อมูลบัญชีผู้ใช้</strong></p>
      <ul>
        <li>ชื่อ-นามสกุล</li>
        <li>อีเมล</li>
        <li>วันเกิด</li>
        <li>เพศ</li>
        <li>รหัสผ่าน (เข้ารหัสด้วย bcrypt)</li>
      </ul>
      <p><strong>2.2 ข้อมูลร้านค้า</strong></p>
      <ul>
        <li>ชื่อร้าน, รหัสอ้างอิง (Ref Code)</li>
        <li>ข้อมูลสาขาและโครงสร้างองค์กร</li>
      </ul>
      <p><strong>2.3 ข้อมูลการใช้งาน</strong></p>
      <ul>
        <li>บันทึกใบงานซ่อม (ชื่อลูกค้า, ทะเบียนรถ, อาการ, รูปภาพ)</li>
        <li>ข้อมูลคลังอะไหล่</li>
        <li>เวลาเข้าใช้งานล่าสุด (Last Activity)</li>
        <li>Log การดำเนินงาน</li>
      </ul>
      <p><strong>2.4 ข้อมูลการชำระเงิน</strong></p>
      <p>
        การชำระเงินดำเนินการผ่าน Stripe ซึ่งเป็นผู้ให้บริการชำระเงินที่ได้รับการรับรอง PCI DSS
        เราไม่จัดเก็บข้อมูลบัตรเครดิตหรือข้อมูลการชำระเงินโดยตรง
      </p>

      <h2>3. วัตถุประสงค์ในการใช้ข้อมูล</h2>
      <ul>
        <li>ให้บริการและดำเนินการบัญชีของท่าน</li>
        <li>จัดการ Subscription และการชำระเงิน</li>
        <li>ปรับปรุงและพัฒนาบริการ</li>
        <li>ส่งการแจ้งเตือนที่เกี่ยวข้องกับบัญชี</li>
        <li>ปฏิบัติตามข้อกำหนดทางกฎหมาย</li>
        <li>ป้องกันการทุจริตและการใช้งานที่ผิดวัตถุประสงค์</li>
      </ul>

      <h2>4. การเปิดเผยข้อมูลแก่บุคคลที่สาม</h2>
      <p>เราอาจเปิดเผยข้อมูลแก่:</p>
      <ul>
        <li><strong>Stripe</strong> — สำหรับการประมวลผลการชำระเงิน</li>
        <li><strong>ผู้ให้บริการ Cloud</strong> — สำหรับโครงสร้างพื้นฐานและจัดเก็บข้อมูล</li>
        <li><strong>หน่วยงานราชการ</strong> — เมื่อมีข้อกำหนดทางกฎหมาย</li>
      </ul>
      <p>เราไม่ขายข้อมูลส่วนบุคคลของท่านให้บุคคลที่สามเพื่อวัตถุประสงค์ทางการตลาด</p>

      <h2>5. ความปลอดภัยของข้อมูล</h2>
      <ul>
        <li>การส่งข้อมูลเข้ารหัสด้วย TLS/HTTPS</li>
        <li>รหัสผ่านเข้ารหัสด้วย bcrypt (cost factor 12)</li>
        <li>การควบคุมการเข้าถึงตาม Role (RBAC)</li>
        <li>Session หมดอายุอัตโนมัติใน 8 ชั่วโมง</li>
      </ul>

      <h2>6. สิทธิ์ของเจ้าของข้อมูล (PDPA)</h2>
      <p>ท่านมีสิทธิ์ดังต่อไปนี้:</p>
      <ul>
        <li><strong>สิทธิ์รับรู้</strong> — รับทราบว่าข้อมูลใดถูกเก็บรวบรวม</li>
        <li><strong>สิทธิ์เข้าถึง</strong> — ขอสำเนาข้อมูลส่วนบุคคลของท่าน</li>
        <li><strong>สิทธิ์แก้ไข</strong> — ขอแก้ไขข้อมูลที่ไม่ถูกต้อง</li>
        <li><strong>สิทธิ์ลบ</strong> — ขอลบข้อมูลของท่าน</li>
        <li><strong>สิทธิ์คัดค้าน</strong> — คัดค้านการประมวลผลข้อมูล</li>
        <li><strong>สิทธิ์โอนย้าย</strong> — ขอรับข้อมูลในรูปแบบที่ใช้งานได้</li>
      </ul>
      <p>ติดต่อใช้สิทธิ์ได้ที่: <a href={`mailto:${legalEmail}`}>{legalEmail}</a></p>

      <h2>7. การเก็บรักษาข้อมูล</h2>
      <p>
        เราเก็บข้อมูลบัญชีตลอดระยะเวลาที่บัญชียังใช้งานอยู่ และอีก 90 วันหลังจากปิดบัญชี
        ข้อมูลการชำระเงินเก็บตามที่ Stripe และกฎหมายกำหนด
      </p>

      <h2>8. การเปลี่ยนแปลงนโยบาย</h2>
      <p>
        เราจะแจ้งผ่านอีเมลหรือการแจ้งเตือนในแอพอย่างน้อย 30 วันก่อนมีการเปลี่ยนแปลงที่มีสาระสำคัญ
      </p>

      <h2>9. ติดต่อเรา</h2>
      <p>
        {companyName}<br />
        อีเมล: <a href={`mailto:${legalEmail}`}>{legalEmail}</a>
      </p>
    </div>
  )

  const en = (
    <div style={{ maxWidth: 780, lineHeight: 1.9, fontSize: 15 }}>
      <p><strong>Effective Date:</strong> {effectiveDate}</p>

      <h2>1. Introduction</h2>
      <p>
        {companyName} ("Company", "we", "us") is committed to protecting your privacy. This policy explains
        how we collect, use, and safeguard your personal information when you use {appName}, in compliance
        with Thailand's Personal Data Protection Act B.E. 2562 (PDPA).
      </p>

      <h2>2. Information We Collect</h2>
      <p><strong>2.1 Account Information</strong></p>
      <ul>
        <li>Full name</li>
        <li>Email address</li>
        <li>Date of birth</li>
        <li>Gender</li>
        <li>Password (bcrypt-hashed)</li>
      </ul>
      <p><strong>2.2 Business Information</strong></p>
      <ul>
        <li>Shop name and reference code</li>
        <li>Branch and organizational structure</li>
      </ul>
      <p><strong>2.3 Usage Data</strong></p>
      <ul>
        <li>Job records (customer name, license plate, symptoms, images)</li>
        <li>Inventory data</li>
        <li>Last activity timestamps</li>
        <li>Operation logs</li>
      </ul>
      <p><strong>2.4 Payment Information</strong></p>
      <p>
        Payments are processed via Stripe, a PCI DSS-certified payment provider.
        We do not store credit card or payment details directly.
      </p>

      <h2>3. How We Use Your Information</h2>
      <ul>
        <li>Provide and operate your account</li>
        <li>Manage subscriptions and billing</li>
        <li>Improve and develop our services</li>
        <li>Send account-related notifications</li>
        <li>Comply with legal obligations</li>
        <li>Prevent fraud and abuse</li>
      </ul>

      <h2>4. Third-Party Disclosure</h2>
      <p>We may share data with:</p>
      <ul>
        <li><strong>Stripe</strong> — for payment processing</li>
        <li><strong>Cloud providers</strong> — for infrastructure and storage</li>
        <li><strong>Government authorities</strong> — when required by law</li>
      </ul>
      <p>We do not sell your personal data to third parties for marketing purposes.</p>

      <h2>5. Data Security</h2>
      <ul>
        <li>All data transmitted over TLS/HTTPS</li>
        <li>Passwords hashed with bcrypt (cost factor 12)</li>
        <li>Role-based access control (RBAC)</li>
        <li>Sessions expire automatically after 8 hours</li>
      </ul>

      <h2>6. Your Rights (PDPA)</h2>
      <ul>
        <li><strong>Right to be informed</strong> — know what data is collected</li>
        <li><strong>Right of access</strong> — request a copy of your data</li>
        <li><strong>Right to rectification</strong> — correct inaccurate data</li>
        <li><strong>Right to erasure</strong> — request deletion of your data</li>
        <li><strong>Right to object</strong> — object to data processing</li>
        <li><strong>Right to portability</strong> — receive data in a usable format</li>
      </ul>
      <p>To exercise your rights, contact: <a href={`mailto:${legalEmail}`}>{legalEmail}</a></p>

      <h2>7. Data Retention</h2>
      <p>
        We retain account data for the duration of active accounts and 90 days after account closure.
        Payment records are retained as required by Stripe and applicable law.
      </p>

      <h2>8. Policy Changes</h2>
      <p>
        We will notify you via email or in-app notification at least 30 days before any material changes.
      </p>

      <h2>9. Contact Us</h2>
      <p>
        {companyName}<br />
        Email: <a href={`mailto:${legalEmail}`}>{legalEmail}</a>
      </p>
    </div>
  )

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button.Group>
          <Button type={lang === 'th' ? 'primary' : 'default'} onClick={() => setLang('th')}>ภาษาไทย</Button>
          <Button type={lang === 'en' ? 'primary' : 'default'} onClick={() => setLang('en')}>English</Button>
        </Button.Group>
      </div>
      {lang === 'th' ? th : en}
    </>
  )
}
