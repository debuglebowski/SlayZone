type DiagnosticsContext = Record<string, unknown>

let diagnosticsContext: DiagnosticsContext = {}

export function updateDiagnosticsContext(next: DiagnosticsContext): void {
  diagnosticsContext = { ...diagnosticsContext, ...next }
}

export function getDiagnosticsContext(): DiagnosticsContext {
  return { ...diagnosticsContext }
}

export function recordDiagnosticsTimeline(
  event: string,
  payload?: Record<string, unknown>
): void {
  try {
    window.api.diagnostics.recordClientEvent({
      event: `renderer.timeline.${event}`,
      level: 'info',
      message: event,
      payload: {
        ...payload,
        context: getDiagnosticsContext()
      }
    })
  } catch {
    // ignore diagnostics failures
  }
}
