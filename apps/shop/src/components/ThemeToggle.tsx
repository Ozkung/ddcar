'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { isDark, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'เปลี่ยนเป็น Light Mode' : 'เปลี่ยนเป็น Dark Mode'}
      style={{
        background: 'rgba(255,255,255,0.15)',
        border: 'none',
        borderRadius: 20,
        padding: '4px 10px',
        cursor: 'pointer',
        color: 'rgba(255,255,255,0.85)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}
