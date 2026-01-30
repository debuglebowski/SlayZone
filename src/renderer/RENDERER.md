# Renderer Process

React frontend running in Electron's sandboxed browser environment.

## Entry Point

`src/main.tsx` - Mounts React app with providers.

## Structure

```
renderer/src/
├── main.tsx              # React entry
├── App.tsx               # Root component, tab routing
├── assets/
│   ├── main.css          # Tailwind entry
│   └── logo.svg
├── domains/
│   ├── tasks/            # Kanban, filters, list views
│   │   ├── DOMAIN.md
│   │   ├── components/   # KanbanBoard, FilterBar, etc.
│   │   ├── hooks/        # useTasksData, useFilterState
│   │   └── lib/          # kanban utilities
│   ├── task/             # Single task detail
│   │   ├── DOMAIN.md
│   │   └── components/   # TaskDetailPage, dialogs
│   ├── projects/         # Project dialogs
│   │   ├── DOMAIN.md
│   │   └── components/
│   ├── tags/             # Tag components
│   │   ├── DOMAIN.md
│   │   └── components/
│   ├── terminal/         # xterm.js, PTY context
│   │   ├── DOMAIN.md
│   │   ├── components/   # Terminal, StatusPopover
│   │   ├── context/      # PtyContext
│   │   └── hooks/        # usePtyStatus
│   ├── settings/         # Theme, preferences
│   │   ├── DOMAIN.md
│   │   ├── components/   # UserSettingsDialog
│   │   ├── context/      # ThemeContext
│   │   └── hooks/        # useViewState
│   └── onboarding/       # Tutorial
│       ├── DOMAIN.md
│       └── components/
├── components/           # Shared UI
│   ├── ui/               # Shadcn primitives
│   ├── sidebar/          # AppSidebar
│   ├── tabs/             # TabBar
│   └── animations/       # AnimatedPage, SuccessToast
├── hooks/                # Shared hooks
└── lib/
    └── utils.ts          # cn() helper
```

## App.tsx

Root component coordinating domains:

- Tab navigation (home, task detail tabs)
- Dialog orchestration
- Keyboard shortcuts
- Data loading via `useTasksData()`

## IPC Access

All main process calls via `window.api`:

```typescript
const tasks = await window.api.db.getTasks()
await window.api.pty.create(taskId, cwd, mode)
```

## Key Domain Exports

### tasks

```typescript
import { KanbanBoard, FilterBar, useTasksData, useFilterState } from '@/domains/tasks'
```

### terminal

```typescript
import { Terminal, PtyProvider, usePty, usePtyStatus } from '@/domains/terminal'
```

### settings

```typescript
import { ThemeProvider, useTheme, useViewState } from '@/domains/settings'
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New task |
| `Cmd+Shift+N` | Quick run |
| `Cmd+K` | Search |
| `Cmd+W` | Close tab/window |
| `Cmd+1-9` | Switch to tab |

## UI Components

Using Shadcn/ui (Radix primitives + Tailwind) in `components/ui/`.
