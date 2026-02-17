# SlayZone

Desktop task management app with integrated AI coding assistants (Claude Code, Codex).

## Quick Start



```bash
pnpm install
```

**Never start the dev server** - user runs it separately.

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
│   └── app/             # @slayzone/app - Electron shell
└── domains/
│   ├── terminal/        # @slayzone/terminal
│   ├── task/            # @slayzone/task
│   ├── tasks/           # @slayzone/tasks
│   ├── projects/        # @slayzone/projects
│   ├── tags/            # @slayzone/tags
│   ├── settings/        # @slayzone/settings
│   ├── onboarding/      # @slayzone/onboarding
│   └── worktrees/       # @slayzone/worktrees
└── shared/
    ├── types/           # @slayzone/types - ElectronAPI
    ├── ui/              # @slayzone/ui - Components
    └── editor/          # @slayzone/editor - TipTap
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
| @slayzone/terminal | TerminalMode, PtyInfo | PTY handlers | Terminal, PtyProvider |
| @slayzone/task | Task, schemas | Task CRUD, AI | TaskDetailPage, dialogs |
| @slayzone/tasks | (empty) | (empty) | KanbanBoard, useTasksData |
| @slayzone/projects | Project | Project CRUD | ProjectSelect, dialogs |
| @slayzone/tags | Tag | Tag CRUD | - |
| @slayzone/settings | Theme | Settings, theme | ThemeProvider |
| @slayzone/onboarding | (empty) | (empty) | OnboardingDialog |
| @slayzone/worktrees | Worktree, DetectedWorktree | Git ops, worktree CRUD | GitPanel |

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
| `packages/apps/app/src/main/index.ts` | App entry, DI |
| `packages/apps/app/src/renderer/src/App.tsx` | Main React |
| `packages/domains/tasks/src/client/useTasksData.ts` | Core state |
| `packages/domains/terminal/src/main/pty-manager.ts` | PTY lifecycle |

## Terminal Modes

- `claude-code` - Claude Code CLI
- `codex` - OpenAI Codex CLI
- `terminal` - Plain shell

## Database

SQLite in user data. Schema: `packages/apps/app/src/main/db/migrations.ts`
