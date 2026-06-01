'use client'

import { useState } from 'react'
import { Button } from 'antd'

interface Props {
  appName: string
  companyName: string
  legalEmail: string
  effectiveDate: string
}

export default function TermsTabs({ appName, companyName, legalEmail, effectiveDate }: Props) {
  const [lang, setLang] = useState<'th' | 'en'>('th')

  const th = (
    <div style={{ maxWidth: 780, lineHeight: 1.9, fontSize: 15 }}>
      <p><strong>วันที่มีผลบังคับใช้:</strong> {effectiveDate}</p>

      <h2>1. การยอมรับข้อกำหนด</h2>
      <p>
        การเข้าใช้งานหรือลงทะเบียนบัญชีบน {appName} ถือว่าท่านยอมรับข้อกำหนดและเงื่อนไขการให้บริการฉบับนี้
        หากท่านไม่ยอมรับ กรุณาหยุดใช้งานบริการ
      </p>

      <h2>2. คำอธิบายบริการ</h2>
      <p>
        {appName} เป็นซอฟต์แวร์การจัดการร้านซ่อมรถยนต์แบบ SaaS ที่ให้บริการ ได้แก่
        การจัดการใบงานซ่อม คลังอะไหล่ การโอนสต็อก ระบบพันธมิตร รายงาน และการวิเคราะห์ข้อมูล
      </p>

      <h2>3. บัญชีผู้ใช้</h2>
      <ul>
        <li>ท่านต้องมีอายุไม่ต่ำกว่า 18 ปีในการลงทะเบียน</li>
        <li>ท่านรับผิดชอบในการรักษาความลับของรหัสผ่าน</li>
        <li>บัญชีหนึ่งใช้ได้กับร้านค้าหนึ่งเท่านั้น (ยกเว้นบัญชีองค์กร)</li>
        <li>ห้ามโอน ขาย หรือให้ผู้อื่นใช้บัญชีของท่าน</li>
      </ul>

      <h2>4. Subscription และการชำระเงิน</h2>
      <p><strong>4.1 แผนบริการ</strong></p>
      <ul>
        <li><strong>Free Trial:</strong> ทดลองใช้ฟรี 30 วัน มีข้อจำกัดตามที่ระบุ</li>
        <li><strong>Pro:</strong> 1,000 บาท/เดือน หลังจาก trial หมดอายุ</li>
        <li><strong>Enterprise:</strong> ติดต่อฝ่ายขาย</li>
      </ul>
      <p><strong>4.2 การต่ออายุและการยกเลิก</strong></p>
      <ul>
        <li>Subscription ต่ออายุอัตโนมัติทุกเดือน</li>
        <li>ยกเลิกได้ทุกเวลาผ่านหน้า Billing ก่อนรอบบิลถัดไป</li>
        <li>ไม่คืนเงินสำหรับระยะเวลาที่ใช้ไปแล้วบางส่วน</li>
      </ul>
      <p><strong>4.3 ราคาและการเปลี่ยนแปลง</strong></p>
      <p>เราจะแจ้งการเปลี่ยนแปลงราคาล่วงหน้าอย่างน้อย 30 วันทางอีเมล</p>

      <h2>5. ข้อจำกัดการใช้งาน</h2>
      <p>ท่านตกลงที่จะไม่:</p>
      <ul>
        <li>ใช้บริการเพื่อวัตถุประสงค์ที่ผิดกฎหมาย</li>
        <li>พยายามเข้าถึงข้อมูลของร้านค้าอื่นโดยไม่ได้รับอนุญาต</li>
        <li>Reverse engineer หรือพยายามดึงซอร์สโค้ด</li>
        <li>ส่งข้อมูลเท็จหรือทำให้เกิดความเข้าใจผิด</li>
        <li>ใช้งานในลักษณะที่ก่อให้เกิดภาระเกินควรต่อเซิร์ฟเวอร์</li>
      </ul>

      <h2>6. ทรัพย์สินทางปัญญา</h2>
      <p>
        {appName} และองค์ประกอบทั้งหมด รวมถึงซอฟต์แวร์ ออกแบบ โลโก้ และเนื้อหา
        เป็นทรัพย์สินของ {companyName} และได้รับการคุ้มครองตามกฎหมายทรัพย์สินทางปัญญา
        ข้อมูลที่ท่านป้อนเข้าสู่ระบบยังคงเป็นทรัพย์สินของท่าน
      </p>

      <h2>7. ข้อจำกัดความรับผิด</h2>
      <p>
        {companyName} ไม่รับผิดชอบต่อความเสียหายทางอ้อม ที่เกิดขึ้นโดยบังเอิญ หรือเป็นผลสืบเนื่อง
        รวมถึงการสูญเสียรายได้หรือข้อมูล ความรับผิดสูงสุดของเราจำกัดอยู่ที่จำนวนเงินที่ท่านชำระ
        ในช่วง 3 เดือนก่อนเกิดเหตุ
      </p>

      <h2>8. ข้อมูลและการสำรองข้อมูล</h2>
      <p>
        เราดำเนินการสำรองข้อมูลเป็นประจำ อย่างไรก็ตาม เราแนะนำให้ท่านดาวน์โหลดและสำรองข้อมูลของท่านเองด้วย
        หลังยกเลิกบัญชี ท่านมีเวลา 30 วันในการส่งออกข้อมูลก่อนที่จะถูกลบถาวร
      </p>

      <h2>9. การระงับและยกเลิกบัญชี</h2>
      <p>เราขอสงวนสิทธิ์ระงับหรือยกเลิกบัญชีหากพบ:</p>
      <ul>
        <li>การละเมิดข้อกำหนดเหล่านี้</li>
        <li>การไม่ชำระเงินหลังจากระยะเวลา Grace Period</li>
        <li>การใช้งานที่เป็นอันตรายต่อระบบหรือผู้ใช้อื่น</li>
      </ul>

      <h2>10. กฎหมายที่ใช้บังคับ</h2>
      <p>
        ข้อกำหนดนี้อยู่ภายใต้กฎหมายไทย ข้อพิพาทใดๆ ให้อยู่ในเขตอำนาจของศาลไทย
      </p>

      <h2>11. การเปลี่ยนแปลงข้อกำหนด</h2>
      <p>
        เราจะแจ้งผ่านอีเมลหรือการแจ้งเตือนในแอพอย่างน้อย 30 วันก่อนมีการเปลี่ยนแปลงที่มีสาระสำคัญ
        การใช้งานต่อเนื่องหลังจากนั้นถือเป็นการยอมรับข้อกำหนดใหม่
      </p>

      <h2>12. ติดต่อเรา</h2>
      <p>
        {companyName}<br />
        อีเมล: <a href={`mailto:${legalEmail}`}>{legalEmail}</a>
      </p>
    </div>
  )

  const en = (
    <div style={{ maxWidth: 780, lineHeight: 1.9, fontSize: 15 }}>
      <p><strong>Effective Date:</strong> {effectiveDate}</p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or registering an account on {appName}, you agree to these Terms of Service.
        If you do not agree, please discontinue use of the service.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        {appName} is a SaaS automotive repair shop management software providing
        job management, inventory, stock transfers, partner networks, reporting, and analytics.
      </p>

      <h2>3. Account Registration</h2>
      <ul>
        <li>You must be at least 18 years old to register</li>
        <li>You are responsible for maintaining password confidentiality</li>
        <li>One account per shop (except enterprise accounts)</li>
        <li>You may not transfer or sell your account</li>
      </ul>

      <h2>4. Subscription and Payment</h2>
      <p><strong>4.1 Plans</strong></p>
      <ul>
        <li><strong>Free Trial:</strong> 30-day free trial with feature limits</li>
        <li><strong>Pro:</strong> 1,000 THB/month after trial expires</li>
        <li><strong>Enterprise:</strong> Contact sales</li>
      </ul>
      <p><strong>4.2 Renewal and Cancellation</strong></p>
      <ul>
        <li>Subscriptions renew automatically each month</li>
        <li>Cancel anytime via the Billing page before the next billing cycle</li>
        <li>No refunds for partial periods already used</li>
      </ul>
      <p><strong>4.3 Pricing Changes</strong></p>
      <p>We will notify you of price changes at least 30 days in advance via email.</p>

      <h2>5. Prohibited Uses</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service for unlawful purposes</li>
        <li>Attempt to access another shop's data without authorization</li>
        <li>Reverse engineer or attempt to extract source code</li>
        <li>Submit false or misleading information</li>
        <li>Use the service in ways that impose unreasonable server load</li>
      </ul>

      <h2>6. Intellectual Property</h2>
      <p>
        {appName} and all its components — including software, design, logos, and content —
        are the property of {companyName} and protected by intellectual property law.
        Data you input into the system remains your property.
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        {companyName} is not liable for indirect, incidental, or consequential damages,
        including loss of revenue or data. Our maximum liability is limited to the amount
        you paid in the 3 months preceding the incident.
      </p>

      <h2>8. Data and Backups</h2>
      <p>
        We perform regular backups; however, we recommend you export and back up your own data.
        After account cancellation, you have 30 days to export data before permanent deletion.
      </p>

      <h2>9. Suspension and Termination</h2>
      <p>We reserve the right to suspend or terminate accounts for:</p>
      <ul>
        <li>Violation of these Terms</li>
        <li>Non-payment after the Grace Period</li>
        <li>Activity harmful to the system or other users</li>
      </ul>

      <h2>10. Governing Law</h2>
      <p>
        These Terms are governed by the laws of Thailand.
        Any disputes shall be subject to the jurisdiction of Thai courts.
      </p>

      <h2>11. Changes to Terms</h2>
      <p>
        We will notify you via email or in-app notification at least 30 days before material changes.
        Continued use after that date constitutes acceptance of the new terms.
      </p>

      <h2>12. Contact Us</h2>
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
