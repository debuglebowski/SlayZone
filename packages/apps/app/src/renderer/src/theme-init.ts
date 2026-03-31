import { applyTheme } from '@slayzone/settings/client'

// Default dark with CSS fallback, then resolve persisted preference + theme.
applyTheme('dark')
void Promise.all([
  window.api.theme.getEffective(),
  window.api.settings.get('app_theme_id'),
]).then(([effective, themeId]) => {
  applyTheme(effective === 'light' ? 'light' : 'dark', themeId ?? undefined)
}).catch(() => {})
