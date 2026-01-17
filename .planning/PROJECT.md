# Focus

## What This Is

A desktop task management app with kanban board, AI-powered Work Mode, and focused UX. Single SQLite database as source of truth. Prevents rabbit-holing through prioritized task flow and focused workspace.

## Core Value

One place for all tasks with focused Work Mode that prevents rabbit-holing on low-priority work.

## Requirements

### Validated

- ✓ SQLite database for tasks, projects, workspace items — v1.0
- ✓ Project-based organization with colors — v1.0
- ✓ Kanban board with drag-drop between columns — v1.0
- ✓ Grouping by status, priority, or due date — v1.0
- ✓ Filtering by priority, due, tags, blocked, done — v1.0
- ✓ Task detail view with inline editing — v1.0
- ✓ Subtasks with independent status — v1.0
- ✓ Blocked tasks with reason — v1.0
- ✓ "What Next" prioritization logic — v1.0
- ✓ Work Mode focused workspace — v1.0
- ✓ Work Mode AI Chat (spawns Claude CLI with task context) — v1.0
- ✓ Work Mode Browser tabs (embedded web views) — v1.0
- ✓ Work Mode Living documents (editable markdown) — v1.0
- ✓ First launch onboarding — v1.0
- ✓ User settings (tags, database location) — v1.0
- ✓ Keyboard shortcuts (n for new task, esc to close) — v1.0
- ✓ Theme toggle (light/dark/system) — v1.1
- ✓ Global search across projects — v1.1
- ✓ Archive/delete tasks — v1.1
- ✓ Settings redesign with Claude status — v1.1
- ✓ Task screen narrow layout with metadata sidebar — v1.1
- ✓ Subtasks navigable and collapsed by default — v1.1
- ✓ Work Mode empty state with action buttons — v1.1
- ✓ Work Mode sidebar improvements — v1.1

### Active

(Next milestone requirements defined via `/gsd:define-requirements`)

### Out of Scope

- Claude Code commands / MCP server — app owns data, passes context to Claude
- Tauri — switched to Electron for Node backend
- Recurring tasks — v2
- Time tracking — v2
- Mobile app — v2
- Export/Import — v2
- Customizable statuses — fixed workflow is opinionated

## Context

Shipped v1.1 with ~119,000 LOC TypeScript.

**Tech stack:** Electron-Vite, React, SQLite (better-sqlite3), shadcn/ui, Tailwind v4, dnd-kit, react-markdown

**Architecture:** Main process handles SQLite + IPC + Claude spawning. Preload exposes typed API. Renderer is pure React.

Detailed UI spec in `SPEC.md`. Covers 3 pages (Kanban, Task Detail, Work Mode), all modals, and interactions.

## Constraints

- **Stack**: Electron + React + SQLite + shadcn/ui + Tailwind
- **AI integration**: Node backend spawns Claude CLI, passes task context, streams response
- **Data**: App reads SQLite, Claude never accesses DB directly

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron over Tauri | Node backend can spawn Claude CLI directly | ✓ Good |
| App provides context to Claude | Simpler than giving Claude DB access, more control | ✓ Good |
| shadcn/ui + Tailwind | Accessible components, flexible styling, good DX | ✓ Good |
| WAL mode for SQLite | Better concurrent performance | ✓ Good |
| IPC channel naming: db:entity:action | Consistent, discoverable | ✓ Good |
| ViewState discriminated union | State-based routing without router library | ✓ Good |
| dnd-kit for drag-drop | Best React DnD library, accessible | ✓ Good |
| Only status grouping enables drag-drop | Priority/due columns read-only makes sense | ✓ Good |
| Single active Claude process | Prevents resource exhaustion | ✓ Good |
| useReducer for streaming state | Predictable state transitions | ✓ Good |

## Current State

**Shipped:** v1.1 UX & Features (2026-01-17)

Key features delivered in v1.1:
- Theme system (light/dark/system toggle)
- Global search (Cmd+K)
- Task archive/delete lifecycle
- Settings redesign with Claude status
- Task screen narrow layout with metadata sidebar
- Subtasks navigable and collapsed
- Work Mode empty state and sidebar improvements

**Next milestone:** TBD — use `/gsd:discuss-milestone` to explore

---
*Last updated: 2026-01-17 after v1.1 milestone completion*
