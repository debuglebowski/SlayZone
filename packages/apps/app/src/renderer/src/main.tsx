import './assets/main.css'

import { createRoot } from 'react-dom/client'
import { ThemeProvider, tabStoreReady, useTabStore } from '@slayzone/settings'
import { PtyProvider } from '@slayzone/terminal'
import { TelemetryProvider } from '@slayzone/telemetry/client'
import { UndoProvider } from '@slayzone/ui'
import { taskDetailCache } from '@slayzone/task/client/taskDetailCache'
import App from './App'
import { getDiagnosticsContext } from './lib/diagnosticsClient'
import { ConvexAuthBootstrap } from './lib/convexAuth'

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

// Wait for tab store to hydrate from SQLite before rendering —
// prevents race conditions where effects wipe persisted tabs.
tabStoreReady.then(() => {
  // Prefetch task details for open tabs — warms Suspense cache before React mounts.
  // Fire-and-forget: the cache's resolved-value tracking + notify ensures immediate
  // re-render when data arrives, eliminating the 250ms use() scheduling delay.
  for (const tab of useTabStore.getState().tabs) {
    if (tab.type === 'task') taskDetailCache.prefetch('taskDetail', tab.taskId)
  }

  performance.mark('sz:reactMount')
  createRoot(document.getElementById('root')!).render(
    <ConvexAuthBootstrap>
      <PtyProvider>
        <ThemeProvider>
          <TelemetryProvider>
            <UndoProvider>
              <App />
            </UndoProvider>
          </TelemetryProvider>
        </ThemeProvider>
      </PtyProvider>
    </ConvexAuthBootstrap>
  )
})
