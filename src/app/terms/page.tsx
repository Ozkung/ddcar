import TermsTabs from './LegalTabs'

export default function TermsPage() {
  const appName     = process.env.NEXT_PUBLIC_APP_NAME     ?? 'ดีดีช่างยนต์'
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'บริษัท ดีดีช่างยนต์ จำกัด'
  const legalEmail  = process.env.NEXT_PUBLIC_LEGAL_EMAIL  ?? 'legal@ddcar.app'
  const effectiveDate = '2 มิถุนายน 2569 / June 2, 2026'

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>ข้อกำหนดการให้บริการ / Terms of Service</h2>
      <TermsTabs
        appName={appName}
        companyName={companyName}
        legalEmail={legalEmail}
        effectiveDate={effectiveDate}
      />
    </div>
  )
}
