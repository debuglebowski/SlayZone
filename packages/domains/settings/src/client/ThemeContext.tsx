import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Theme, ThemePreference } from '@slayzone/settings/shared'

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
    const applyTheme = (nextTheme: Theme) => {
      document.documentElement.classList.toggle('dark', nextTheme === 'dark')
      document.documentElement.dataset.theme = nextTheme
      document.documentElement.style.colorScheme = nextTheme
    }

    void Promise.all([
      window.api.theme.getEffective(),
      window.api.theme.getSource()
    ]).then(([effective, source]) => {
      const effectiveTheme = effective === 'light' ? 'light' : 'dark'
      const pref = source === 'light' ? 'light' : 'dark'
      setTheme(effectiveTheme)
      setPreferenceState(pref)
      applyTheme(effectiveTheme)
    }).catch(() => {
      applyTheme('dark')
    })

    const unsubscribe = window.api.theme.onChange((effective) => {
      const effectiveTheme = effective === 'light' ? 'light' : 'dark'
      setTheme(effectiveTheme)
      applyTheme(effectiveTheme)
    })

    return unsubscribe
  }, [])

  const setPreference = async (pref: ThemePreference) => {
    const effective = await window.api.theme.set(pref)
    const effectiveTheme = effective === 'light' ? 'light' : 'dark'
    const nextPreference = pref === 'light' ? 'light' : 'dark'
    setPreferenceState(nextPreference)
    setTheme(effectiveTheme)
    document.documentElement.classList.toggle('dark', effectiveTheme === 'dark')
    document.documentElement.dataset.theme = effectiveTheme
    document.documentElement.style.colorScheme = effectiveTheme
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
