# Architecture

## Overview

OmgSlayZone is an Electron desktop app following the standard main/renderer/preload pattern with SQLite persistence and integrated terminal emulation. Codebase organized by **domains**.

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   SQLite    │  │   domains/  │  │  domains/       │  │
│  │  (better-   │  │  task/      │  │  terminal/      │  │
│  │  sqlite3)   │  │  projects/  │  │  pty-manager    │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ IPC (contextBridge)
┌────────────────────────┴────────────────────────────────┐
│                   Electron Renderer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  domains/   │  │  domains/   │  │   domains/      │  │
│  │  tasks/     │  │  terminal/  │  │   settings/     │  │
│  │  task/      │  │  (xterm.js) │  │   (theme)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── main/
│   ├── index.ts              # App entry, IPC registration
│   ├── db/                   # Database setup, migrations
│   └── domains/
│       ├── task/             # Task CRUD, AI, dependencies
│       ├── projects/         # Project CRUD
│       ├── tags/             # Tag CRUD, task-tag links
│       ├── terminal/         # PTY manager, adapters
│       └── settings/         # Preferences, theme
├── renderer/src/
│   ├── App.tsx               # Root, coordinates domains
│   ├── domains/
│   │   ├── tasks/            # Kanban, filters, data hook
│   │   ├── task/             # Detail page, dialogs
│   │   ├── projects/         # Project dialogs
│   │   ├── tags/             # Tag components
│   │   ├── terminal/         # Terminal UI, PTY context
│   │   ├── settings/         # Settings dialog, theme
│   │   └── onboarding/       # Tutorial
│   └── components/           # Shared UI (sidebar, tabs, primitives)
├── preload/
│   └── index.ts              # IPC bridge
└── shared/types/             # Cross-process types
```

## Domains

### tasks (list/collection)

Kanban view, filtering, grouping, bulk operations.

**Renderer**: `domains/tasks/`
- `components/` - KanbanBoard, TaskCard, FilterBar
- `hooks/useTasksData.ts` - Core data state (tasks, projects, tags, handlers)
- `hooks/useFilterState.ts` - Filter persistence
- `lib/kanban.ts` - Grouping logic

### task (single item)

Task CRUD, detail page, dependencies, AI description.

**Main**: `domains/task/`
- `handlers.ts` - CRUD IPC handlers
- `ai.ts` - Description generation

**Renderer**: `domains/task/`
- `components/TaskDetailPage.tsx` - Full task view
- `components/CreateTaskDialog.tsx`
- `components/QuickRunDialog.tsx`
- `components/TaskMetadataSidebar.tsx`

### projects

Project CRUD, repo path association.

**Main**: `domains/projects/handlers.ts`

**Renderer**: `domains/projects/`
- `components/CreateProjectDialog.tsx`
- `components/ProjectSettingsDialog.tsx`
- `components/ProjectSelect.tsx`

### tags

Tag CRUD, task-tag associations.

**Main**: `domains/tags/handlers.ts`

**Renderer**: `domains/tags/components/`

### terminal

PTY lifecycle, mode adapters, xterm rendering.

**Main**: `domains/terminal/`
- `pty-manager.ts` - Session lifecycle
- `handlers.ts` - IPC handlers
- `claude.ts` - Claude Code specific
- `adapters/` - Mode-specific behavior

**Renderer**: `domains/terminal/`
- `components/Terminal.tsx` - xterm.js wrapper
- `context/PtyContext.tsx` - PTY state
- `hooks/usePtyStatus.ts`

### settings

User preferences, theme.

**Main**: `domains/settings/`
- `handlers.ts` - KV store
- `theme.ts` - Theme IPC

**Renderer**: `domains/settings/`
- `components/UserSettingsDialog.tsx`
- `context/ThemeContext.tsx`
- `hooks/useViewState.ts` - Tab/project persistence

### onboarding

First-run tutorial.

**Renderer**: `domains/onboarding/components/OnboardingDialog.tsx`

## Data Flow

### Task Creation
```
User clicks "New Task"
    ↓
CreateTaskDialog.tsx (form)
    ↓
window.api.db.createTask(data)
    ↓
ipcRenderer.invoke('db:tasks:create')
    ↓
domains/task/handlers.ts
    ↓
SQLite INSERT
    ↓
Returns Task object
    ↓
useTasksData updates state
    ↓
KanbanBoard re-renders
```

### Terminal Session
```
TaskDetailPage mounts
    ↓
Terminal.tsx requests PTY
    ↓
window.api.pty.create(taskId, cwd, mode)
    ↓
domains/terminal/pty-manager.ts spawns process
    ↓
Adapter builds command (claude/codex/shell)
    ↓
PTY data streams via IPC
    ↓
xterm.js renders output
```

## Key Patterns

### Domain Hooks

Each domain exports hooks that encapsulate data + handlers:

```typescript
// domains/tasks/hooks/useTasksData.ts
export function useTasksData() {
  const [tasks, setTasks] = useState<Task[]>([])
  // ... load, update, delete handlers
  return { tasks, updateTask, moveTask, archiveTask, ... }
}
```

### Optimistic Updates

UI updates immediately, rollback on error:

```typescript
const handleTaskMove = (taskId, newStatus) => {
  const previousTasks = tasks
  setTasks(tasks.map(t => t.id === taskId ? {...t, status: newStatus} : t))

  window.api.db.updateTask({id: taskId, status: newStatus})
    .catch(() => setTasks(previousTasks))
}
```

### Terminal Adapters

Pluggable adapters for different terminal modes:

```typescript
interface TerminalAdapter {
  buildSpawnConfig(cwd, sessionId, resuming): SpawnConfig
  detectActivity(data): ActivityState
  detectError(data): ErrorInfo | null
  detectPrompt(data): PromptInfo | null
}
```

### Tab-based Navigation

Tasks open in tabs, state persisted in `useViewState`:

```typescript
const [tabs, activeTabIndex, selectedProjectId, ...] = useViewState()
// tabs: [{type: 'home'}, {type: 'task', taskId: '...'}]
```

## Decision Log

| Decision | Rationale |
|----------|-----------|
| SQLite over IndexedDB | Need cross-process access, better-sqlite3 is sync |
| node-pty over web terminal | Real PTY needed for Claude Code CLI |
| Adapter pattern for terminals | Support multiple AI tools with same interface |
| Domain-based organization | Clear boundaries, AI-navigable structure |
| Radix UI primitives | Accessible, unstyled, composable |
