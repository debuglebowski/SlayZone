import type { Theme } from '@slayzone/settings/shared'
import { applyChromeColors, getThemeChrome } from '@slayzone/ui'

export function applyTheme(theme: Theme, themeId?: string): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  if (themeId) {
    applyChromeColors(getThemeChrome(themeId, theme))
  }
}
