# omgslayzone - Product Specification

## Overview

Desktop app for managing multiple Claude Code CLI instances. Kanban-based task management where each task has an embedded terminal running Claude Code.

**Target user:** Developers using LLM CLI coding tools

## Core Concepts

- **Project** = Git repo (has filesystem path)
- **Task** = Unit of work with embedded Claude Code terminal
- **Terminal** = xterm.js instance running Claude Code, persists in background

## Features

### Task Management
- Kanban board (group by status/priority/due date/project)
- Quick create from kanban + full dialog
- Task fields: title, description, status, priority, due_date, project_id
- Archiving (soft delete)
- Search (Cmd+K)

### Organization
- Projects (with repo path)
- Tags
- Filters (status, priority, tags, due date)
- Blocked-by relationship (task dependencies, visual indicator on kanban)

### Terminal
- One terminal per task
- xterm.js
- Runs Claude Code in project's repo path
- Persists when navigating away (detached process)
- Multiple concurrent terminals allowed
- Session resume via claude_session_id

### UI
- Sidebar: projects, filters, tags
- Kanban board (main view)
- Task detail: split view (info left | terminal right)
- Archived tasks view
- Settings dialog (theme, shortcuts)
- Onboarding flow

## Data Model

### projects
| Field | Type | Notes |
|-------|------|-------|
| id | int | PK |
| name | string | |
| color | string | |
| path | string | **NEW** - repo directory |
| created_at | datetime | |
| updated_at | datetime | |

### tasks
| Field | Type | Notes |
|-------|------|-------|
| id | int | PK |
| project_id | int | FK |
| title | string | |
| description | string | |
| status | enum | inbox/backlog/todo/in_progress/review/done |
| priority | int | 1-5 |
| due_date | date | nullable |
| archived_at | datetime | nullable |
| claude_session_id | string | **NEW** - nullable, set on first terminal open |
| created_at | datetime | |
| updated_at | datetime | |

### task_dependencies (NEW)
| Field | Type | Notes |
|-------|------|-------|
| task_id | int | FK - blocked task |
| blocks_task_id | int | FK - blocking task |

### tags
| Field | Type |
|-------|------|
| id | int |
| name | string |
| color | string |
| created_at | datetime |

### task_tags
| Field | Type |
|-------|------|
| task_id | int |
| tag_id | int |

### settings
| Field | Type |
|-------|------|
| key | string |
| value | string |

## Removed from Original

- Subtasks (parent_id)
- Recurring tasks
- Blocked reason (free text)
- Browser tabs
- Document editor
- Dumper
- Work mode page
- workspace_items table
- chat_messages table

## Technical

- Electron + React + TypeScript
- SQLite (better-sqlite3)
- xterm.js + node-pty for terminal
- Tailwind CSS
- Framer Motion

## Technical Decisions

### Terminal
- Full PTY via node-pty + xterm.js
- Interactive, colors, resize, ctrl+c support

### Session Resume
- `claude_session_id` starts null
- On first terminal open: generate UUID, save to task, use `claude --session-id <uuid>`
- On subsequent opens: use `claude --resume <uuid>`
- Creates `~/.claude/projects/<path>/<uuid>.jsonl` automatically

### Process Management (Hybrid)
- Main process holds PTY Map (task_id → PTY reference)
- Renderer reconnects to existing PTY on navigate back
- On app restart: processes die, use `--resume` to recover

### Blocked-by Visual
- Chain-link icon or "blocked" badge on kanban card

## Future

- Worktree support (isolated working dirs per task)

## Key Files

### Database
- `src/main/db/index.ts` - SQLite setup
- `src/main/db/migrations.ts` - Schema migrations

### Types
- `src/shared/types/database.ts` - DB models
- `src/shared/types/api.ts` - IPC API surface

### IPC Handlers
- `src/main/ipc/database.ts` - DB operations
- `src/main/ipc/claude.ts` - Claude CLI (to rebuild for PTY)
- `src/main/services/claude-spawner.ts` - Process spawning (reference)

### Renderer
- `src/renderer/src/App.tsx` - Main router
- `src/renderer/src/components/kanban/` - Kanban board
- `src/renderer/src/components/work-mode/` - To delete
- `src/renderer/src/components/chat/` - To delete
- `src/renderer/src/components/task/TaskDetailPage.tsx` - Split view target

### Config
- `package.json` - Dependencies

## Keyboard Shortcuts

- Cmd+N: New task
- Cmd+K: Search
- Esc: Back/close
- (more TBD)
