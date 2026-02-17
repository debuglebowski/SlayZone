# Diagnostics Domain

Structured diagnostic event capture, redaction, retention, and local export for debugging.

## Exports

- `registerDiagnosticsHandlers(ipcMain, db)` - diagnostics IPC + IPC instrumentation
- `registerProcessDiagnostics(app)` - global process and renderer crash hooks
- `recordDiagnosticEvent(event)` - shared event writer for other domains

## Contract

- Stores events in SQLite (`diagnostics_events`)
- Redacts sensitive data before persistence and export
- Exposes config + export controls via IPC
