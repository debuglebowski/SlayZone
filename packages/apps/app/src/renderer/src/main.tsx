import './assets/main.css'

import { useState, useCallback, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { AnimatePresence } from 'framer-motion'
import { ThemeProvider } from '@slayzone/settings'
import { PtyProvider } from '@slayzone/terminal'
import { TelemetryProvider } from '@slayzone/telemetry/client'
import App from './App'
import { LoadingScreen } from './components/LoadingScreen'
import { getDiagnosticsContext } from './lib/diagnosticsClient'

window.addEventListener('error', (event) => {
  window.api.diagnostics.recordClientError({
    type: 'window.error',
    message: event.message || 'Unknown window error',
    stack: event.error?.stack ?? null,
    url: event.filename ?? null,
    line: event.lineno ?? null,
    column: event.colno ?? null,
    snapshot: getDiagnosticsContext()
  })
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const message = reason instanceof Error ? reason.message : String(reason ?? 'Unknown rejection')
  const stack = reason instanceof Error ? reason.stack : null
  window.api.diagnostics.recordClientError({
    type: 'window.unhandledrejection',
    message,
    stack,
    snapshot: getDiagnosticsContext()
  })
})

function Root(): React.JSX.Element {
  const [showSplash, setShowSplash] = useState(!__PLAYWRIGHT__)
  const dismissSplash = useCallback(() => setShowSplash(false), [])

  useEffect(() => {
    if (!showSplash) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismissSplash() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showSplash, dismissSplash])

  return (
    <PtyProvider>
      <ThemeProvider>
        <TelemetryProvider>
          <App />
          <AnimatePresence>
            {showSplash && <LoadingScreen onDone={dismissSplash} />}
          </AnimatePresence>
        </TelemetryProvider>
      </ThemeProvider>
    </PtyProvider>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
