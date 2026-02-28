const root = document.documentElement

const applyTheme = (theme: 'light' | 'dark'): void => {
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

// Default is dark unless a persisted preference resolves to light.
applyTheme('dark')
void window.api.theme.getEffective().then((effectiveTheme) => {
  applyTheme(effectiveTheme === 'light' ? 'light' : 'dark')
}).catch(() => {
  // Keep dark default when IPC is unavailable/fails during bootstrap.
})
