import { createContext, useContext, useEffect, type ReactNode } from 'react'
import type { Theme, ThemePreference } from '@slayzone/settings/shared'

interface ThemeContextValue {
  theme: Theme
  preference: ThemePreference
  setPreference: (pref: ThemePreference) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Hardcoded dark theme
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  const setPreference = async () => {}

  return (
    <ThemeContext.Provider value={{ theme: 'dark', preference: 'dark', setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
