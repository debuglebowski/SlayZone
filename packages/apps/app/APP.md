# Desktop App

Electron shell that composes domains into a runnable application. No business logic.

## Responsibilities

- Window management (frameless, close handling)
- Main process initialization (db, IPC handlers)
- Renderer entry point (providers, routing)
- Shell components (sidebar, tabs, search)

## Composition

```
main/index.ts
├── Creates BrowserWindow
├── Initializes SQLite database
└── Registers domain handlers (injected ipcMain + db)

renderer/main.tsx
├── PtyProvider (terminal state)
├── ThemeProvider (theme state)
└── App.tsx (sidebar, tabs, dialogs)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/main/index.ts` | Electron entry, handler registration |
| `src/main/db/` | SQLite setup, migrations |
| `src/preload/index.ts` | IPC bridge (window.api) |
| `src/renderer/src/App.tsx` | Main React component |
| `src/renderer/src/components/sidebar/` | Project navigation |
| `src/renderer/src/components/tabs/` | Task tab management |

## Domain Dependencies

All domains injected via IPC:
- `@omgslayzone/terminal/main` - PTY handlers
- `@omgslayzone/task/main` - Task CRUD, AI handlers
- `@omgslayzone/projects/main` - Project handlers
- `@omgslayzone/tags/main` - Tag handlers
- `@omgslayzone/settings/main` - Settings, theme handlers

## Decision Log

**2025-01: Monorepo migration**
Moved from single-package to pnpm workspaces with domain packages.

**2025-01: Dependency injection for handlers**
Handlers receive `ipcMain` and `db` as params instead of importing globals.
