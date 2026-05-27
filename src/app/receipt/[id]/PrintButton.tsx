'use client'

import { Button } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'

export default function PrintButton() {
  return (
    <Button
      icon={<PrinterOutlined />}
      type="primary"
      onClick={() => window.print()}
    >
      พิมพ์ใบงาน
    </Button>
  )
}
