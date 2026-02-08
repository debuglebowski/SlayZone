# AI Config Domain

Centralized management for AI configuration artifacts:

- Skills
- Commands
- Markdown docs (e.g. `AGENTS.md`, `CLAUDE.md`, custom docs)
- Project selections copied from global repository items

## Contracts (`shared/`)

- `AiConfigItem` - Config artifact (global or project scoped)
- `AiConfigProjectSelection` - Per-project selected item with target path
- `AiConfigSourcePlaceholder` - Placeholder records for future external sources

## Main Process (`main/`)

- `registerAiConfigHandlers(ipcMain, db)` - IPC handlers for CRUD and selection state

## Client (`client/`)

- `AiConfigCenter` - Full-screen center layout for managing artifacts
