import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Theme, ThemePreference } from '../../../shared/types/api'

interface ThemeContextValue {
  theme: Theme
  preference: ThemePreference
  setPreference: (pref: ThemePreference) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [preference, setPreferenceState] = useState<ThemePreference>('system')

  // Initialize from main process
  useEffect(() => {
    Promise.all([window.api.theme.getEffective(), window.api.theme.getSource()]).then(
      ([effective, source]) => {
        setTheme(effective)
        setPreferenceState(source)
      }
    )

    // Listen for system theme changes
    const unsubscribe = window.api.theme.onChange((newTheme) => {
      setTheme(newTheme)
    })
    return unsubscribe
  }, [])

  // Apply dark class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const setPreference = async (pref: ThemePreference) => {
    const effective = await window.api.theme.set(pref)
    setPreferenceState(pref)
    setTheme(effective)
  }

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
