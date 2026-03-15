import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Theme, ThemePreference } from '@slayzone/settings/shared'
import { track } from '@slayzone/telemetry/client'
import { applyTheme } from './apply-theme'

interface ThemeContextValue {
  theme: Theme
  preference: ThemePreference
  setPreference: (pref: ThemePreference) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [preference, setPreferenceState] = useState<ThemePreference>('dark')

  useEffect(() => {
    let disposed = false

    const initialize = async () => {
      const [effective, source] = await Promise.all([
        window.api.theme.getEffective(),
        window.api.theme.getSource(),
      ])
      if (disposed) return
      setTheme(effective)
      setPreferenceState(source)
      applyTheme(effective)
    }

    initialize().catch(() => {
      if (disposed) return
      setTheme('dark')
      setPreferenceState('dark')
      applyTheme('dark')
    })

    const unsubscribe = window.api.theme.onChange((effective) => {
      if (disposed) return
      setTheme(effective)
      applyTheme(effective)
    })

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  const setPreference = async (nextPreference: ThemePreference) => {
    const effective = await window.api.theme.set(nextPreference)
    setPreferenceState(nextPreference)
    setTheme(effective)
    applyTheme(effective)
    track('theme_changed', { mode: nextPreference as 'light' | 'dark' | 'system' })
  }

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    preference,
    setPreference,
  }), [theme, preference])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
