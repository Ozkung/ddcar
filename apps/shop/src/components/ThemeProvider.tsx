'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ConfigProvider, theme as antTheme } from 'antd'
import thTH from 'antd/locale/th_TH'

interface ThemeContextValue {
  isDark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ isDark: false, toggle: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('ddcar-theme') === 'dark') setIsDark(true)
  }, [])

  const toggle = useCallback(() => {
    setIsDark(prev => {
      const next = !prev
      localStorage.setItem('ddcar-theme', next ? 'dark' : 'light')
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      <ConfigProvider
        locale={thTH}
        theme={{
          algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token: { fontFamily: 'Sarabun, sans-serif' },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
