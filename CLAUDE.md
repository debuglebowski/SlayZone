# OmgSlayZone

Desktop task management app with integrated AI coding assistants (Claude Code, Codex).

## Quick Start

```bash
npm install
npm run dev
```

## Stack

- **Runtime**: Electron 39
- **Frontend**: React 19, TailwindCSS 4, Radix UI
- **Database**: SQLite (better-sqlite3)
- **Terminal**: node-pty, xterm.js
- **AI**: Claude Code CLI, OpenAI Codex CLI

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details.

```
src/
├── main/           # Electron main process (Node.js)
│   └── domains/    # Domain handlers (task, projects, tags, terminal, settings)
├── renderer/       # React frontend
│   └── src/domains/# Domain components, hooks, lib
├── preload/        # IPC bridge (contextBridge)
└── shared/         # Cross-process types
```

## Domains

| Domain | Main | Renderer |
|--------|------|----------|
| tasks | - | `domains/tasks/` (kanban, filters, hooks) |
| task | `domains/task/` | `domains/task/` (detail, CRUD dialogs, AI) |
| projects | `domains/projects/` | `domains/projects/` (CRUD, settings) |
| tags | `domains/tags/` | `domains/tags/` (CRUD) |
| terminal | `domains/terminal/` | `domains/terminal/` (PTY, xterm) |
| settings | `domains/settings/` | `domains/settings/` (theme, prefs) |
| onboarding | - | `domains/onboarding/` (tutorial) |

## Key Files

| File | Purpose |
|------|---------|
| `src/main/index.ts` | App entry, window creation, IPC registration |
| `src/renderer/src/App.tsx` | Main React component, coordinates domains |
| `src/renderer/src/domains/tasks/hooks/useTasksData.ts` | Core data state (tasks, projects, tags) |
| `src/main/domains/terminal/pty-manager.ts` | Terminal session lifecycle |
| `src/preload/index.ts` | IPC bridge exposing `window.api` |

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Typecheck + build for production |
| `npm run build:mac` | Build macOS .app |
| `npm run typecheck` | Run TypeScript checks |
| `npm run lint` | Run ESLint |

## IPC Pattern

Renderer calls main via `window.api`:

```typescript
// Renderer
const tasks = await window.api.db.getTasks()

// Main (domains/task/handlers.ts)
ipcMain.handle('db:tasks:getAll', () => {
  return db.prepare('SELECT * FROM tasks...').all()
})

// Preload bridges them
db: {
  getTasks: () => ipcRenderer.invoke('db:tasks:getAll')
}
```

## Terminal Modes

Tasks can use different terminal modes:
- `claude-code` - Claude Code CLI with --resume support
- `codex` - OpenAI Codex CLI
- `terminal` - Plain shell

Adapters in `src/main/domains/terminal/adapters/` handle mode-specific behavior.

## Database

SQLite stored in user data directory. Schema in `src/main/db/migrations.ts`.

Core tables: `projects`, `tasks`, `tags`, `task_tags`, `task_dependencies`, `settings`
