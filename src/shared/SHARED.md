# Shared Types

Cross-process type definitions used by both main and renderer.

## Structure

```
shared/
├── domains/           # Domain-scoped types (canonical)
│   ├── task/          # Task, TaskStatus, CreateTaskInput, etc.
│   ├── project/       # Project, CreateProjectInput, etc.
│   ├── tag/           # Tag, CreateTagInput, etc.
│   ├── terminal/      # TerminalState, PtyInfo, etc.
│   ├── settings/      # Theme, ThemePreference
│   └── ai/            # ClaudeAvailability, GenerateDescriptionResult
└── types/             # Re-exports for backwards compat
    ├── database.ts    # Re-exports entity types
    └── api.ts         # Re-exports + ElectronAPI interface
```

## Usage

Prefer importing from domain packages:

```typescript
import type { Task, CreateTaskInput } from '@shared/domains/task'
import type { TerminalState, PtyInfo } from '@shared/domains/terminal'
```

Legacy imports still work:

```typescript
import type { Task } from '../../shared/types/database'
```

## Domain Types

### task

```typescript
type TaskStatus = 'inbox' | 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'

interface Task {
  id: string
  project_id: string
  title: string
  status: TaskStatus
  priority: number  // 1-5
  terminal_mode: TerminalMode
  // ...
}

interface CreateTaskInput { projectId, title, ... }
interface UpdateTaskInput { id, title?, status?, ... }
```

### project

```typescript
interface Project {
  id: string
  name: string
  color: string
  path: string | null  // repo path for terminal cwd
}
```

### tag

```typescript
interface Tag { id, name, color }
```

### terminal

```typescript
type TerminalMode = 'claude-code' | 'codex' | 'terminal'
type TerminalState = 'starting' | 'running' | 'idle' | 'awaiting_input' | 'error' | 'dead'
type ActivityState = 'idle' | 'thinking' | 'tool_use' | 'awaiting_input' | 'unknown'
type CodeMode = 'normal' | 'plan' | 'accept-edits' | 'bypass'

interface PtyInfo { taskId, lastOutputTime, state }
interface PromptInfo { type, text, position }
interface CLIState { alive, activity, error }
```

### settings

```typescript
type Theme = 'light' | 'dark'
type ThemePreference = 'light' | 'dark' | 'system'
```

## ElectronAPI

Full IPC interface exposed via `window.api` - defined in `types/api.ts`.

## Conventions

- All entity IDs are UUIDs (string)
- Dates stored as ISO strings
- Nullable fields use `| null`
- Optional input fields use `?`
