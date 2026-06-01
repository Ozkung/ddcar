'use client'

import { Result, Button } from 'antd'
import { WifiOutlined } from '@ant-design/icons'

export default function OfflinePage() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 'calc(100vh - 56px)',
      padding: '2rem',
    }}>
      <Result
        icon={<WifiOutlined style={{ color: '#d1d5db' }} />}
        title="ไม่มีการเชื่อมต่ออินเทอร์เน็ต"
        subTitle="กรุณาตรวจสอบการเชื่อมต่อ Wi-Fi หรือ LAN แล้วลองใหม่อีกครั้ง"
        extra={
          <Button
            type="primary"
            onClick={() => window.location.reload()}
          >
            ลองอีกครั้ง
          </Button>
        }
      />
    </div>
  )
}
