# Architecture

## Overview

OmgSlayZone is an Electron desktop app organized as a **pnpm monorepo** following the Clara philosophy (see PHILOSOPHY.md).

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main                             │
│  ┌─────────────┐  ┌─────────────────────────────────────┐   │
│  │   SQLite    │  │  Domain Handlers (injected)          │   │
│  │  (better-   │  │  terminal, task, projects, tags,     │   │
│  │  sqlite3)   │  │  settings                            │   │
│  └─────────────┘  └─────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │ IPC (contextBridge)
┌────────────────────────────┴────────────────────────────────┐
│                    Electron Renderer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Domain Clients                                       │   │
│  │  tasks (kanban), task (detail), terminal (xterm),     │   │
│  │  projects, settings, onboarding                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Package Structure

```
packages/
├── apps/
│   └── app/               # @omgslayzone/app - Electron shell
│       └── APP.md
├── domains/
│   ├── terminal/          # @omgslayzone/terminal - PTY, xterm
│   ├── task/              # @omgslayzone/task - Task CRUD, AI
│   ├── tasks/             # @omgslayzone/tasks - Kanban view
│   ├── projects/          # @omgslayzone/projects - Project CRUD
│   ├── tags/              # @omgslayzone/tags - Tag system
│   ├── settings/          # @omgslayzone/settings - Preferences
│   ├── onboarding/        # @omgslayzone/onboarding - Tutorial
│   └── worktrees/         # @omgslayzone/worktrees - Git worktrees
│       └── DOMAIN.md      # Each domain has DOMAIN.md
└── shared/
    ├── types/             # @omgslayzone/types - ElectronAPI contract
    ├── ui/                # @omgslayzone/ui - Radix/shadcn components
    └── editor/            # @omgslayzone/editor - TipTap rich text
```

## Domain Structure

Each domain follows this pattern:

```
domain/
├── DOMAIN.md           # Domain documentation
└── src/
    ├── shared/         # Types, contracts (exported as ./shared)
    ├── main/           # Electron main handlers (exported as ./main)
    └── client/         # React components, hooks (exported as ./client)
```

## Key Domains

| Domain | Purpose | Has Main? |
|--------|---------|-----------|
| terminal | PTY sessions, Claude Code/Codex/shell | ✓ |
| task | Task CRUD, detail view, AI description | ✓ |
| tasks | Kanban board, filtering | - |
| projects | Project management | ✓ |
| tags | Task tagging | ✓ |
| settings | Theme, preferences | ✓ |
| onboarding | Tutorial flow | - |
| worktrees | Git status, branch, worktrees | ✓ |

## Data Flow

### Task Creation
```
CreateTaskDialog (task/client)
    ↓
window.api.db.createTask()
    ↓
preload/index.ts → ipcRenderer.invoke
    ↓
task/main/handlers.ts → SQLite
    ↓
Response → useTasksData → KanbanBoard re-render
```

### Terminal Session
```
Terminal (terminal/client)
    ↓
window.api.pty.create(taskId, cwd, mode)
    ↓
terminal/main/pty-manager.ts → node-pty spawn
    ↓
Mode adapter builds command
    ↓
PTY data streams → xterm.js renders
```

## Dependency Rules

1. **Apps** compose domains. No business logic.
2. **Domains** own their types in `shared/`. May depend on other domains.
3. **Shared packages** (ui, editor, types) are infrastructure. Never import domains.

Allowed domain dependencies:
```
task → terminal, worktrees (TerminalMode, GitPanel)
tasks → task, terminal (types, usePty)
types → all domains (ElectronAPI contract)
```

## Logo & Icons

Z-slash logo in 2 places:
- `packages/apps/app/src/main/index.ts` - native splash screen (inline SVG)
- `packages/apps/app/src/renderer/src/assets/logo.svg` - React UI (`#e5e5e5` stroke)

Generated icons (in `packages/apps/app/`):
- `build/icon.{png,icns,ico}` - app icons
- `resources/icon.png` - dock icon

## Decision Log

| Decision | Rationale |
|----------|-----------|
| pnpm monorepo | Domain isolation, explicit deps |
| Per-domain shared/ | Types stay with domain logic |
| Dependency injection | Handlers receive ipcMain + db, testable |
| SQLite + better-sqlite3 | Cross-process, sync access |
| node-pty | Real PTY for Claude Code CLI |
| Clara philosophy | AI-comprehensible codebase structure |
