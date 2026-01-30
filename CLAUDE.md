# OmgSlayZone

Desktop task management app with integrated AI coding assistants (Claude Code, Codex).

## Quick Start

```bash
pnpm install
pnpm dev
```

## Stack

- **Runtime**: Electron 39
- **Frontend**: React 19, TailwindCSS 4, Radix UI
- **Database**: SQLite (better-sqlite3)
- **Terminal**: node-pty, xterm.js
- **AI**: Claude Code CLI, OpenAI Codex CLI

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system architecture and [PHILOSOPHY.md](./PHILOSOPHY.md) for structural principles.

## Monorepo Structure

```
packages/
├── apps/
│   └── desktop/         # @omgslayzone/app - Electron shell
└── domains/
│   ├── terminal/        # @omgslayzone/terminal
│   ├── task/            # @omgslayzone/task
│   ├── tasks/           # @omgslayzone/tasks
│   ├── projects/        # @omgslayzone/projects
│   ├── tags/            # @omgslayzone/tags
│   ├── settings/        # @omgslayzone/settings
│   └── onboarding/      # @omgslayzone/onboarding
└── shared/
    ├── types/           # @omgslayzone/types - ElectronAPI
    ├── ui/              # @omgslayzone/ui - Components
    └── editor/          # @omgslayzone/editor - TipTap
```

## Domain Structure

Each domain:
```
domain/
├── DOMAIN.md           # Documentation
└── src/
    ├── shared/         # Types, contracts → ./shared
    ├── main/           # IPC handlers → ./main
    └── client/         # React UI → ./client
```

## Domain Packages

| Package | /shared | /main | /client |
|---------|---------|-------|---------|
| @omgslayzone/terminal | TerminalMode, PtyInfo | PTY handlers | Terminal, PtyProvider |
| @omgslayzone/task | Task, schemas | Task CRUD, AI | TaskDetailPage, dialogs |
| @omgslayzone/tasks | - | - | KanbanBoard, useTasksData |
| @omgslayzone/projects | Project | Project CRUD | ProjectSelect, dialogs |
| @omgslayzone/tags | Tag | Tag CRUD | - |
| @omgslayzone/settings | Theme | Settings, theme | ThemeProvider |
| @omgslayzone/onboarding | - | - | OnboardingDialog |

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Build for production |
| `pnpm build:mac` | Build macOS .app |
| `pnpm typecheck` | Typecheck all packages |

## Key Files

| File | Purpose |
|------|---------|
| `packages/apps/desktop/src/main/index.ts` | App entry, DI |
| `packages/apps/desktop/src/renderer/src/App.tsx` | Main React |
| `packages/domains/tasks/src/client/useTasksData.ts` | Core state |
| `packages/domains/terminal/src/main/pty-manager.ts` | PTY lifecycle |

## Terminal Modes

- `claude-code` - Claude Code CLI
- `codex` - OpenAI Codex CLI
- `terminal` - Plain shell

## Database

SQLite in user data. Schema: `packages/apps/desktop/src/main/db/migrations.ts`
