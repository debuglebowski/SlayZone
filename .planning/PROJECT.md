# Focus

## What This Is

A desktop task management app solving attention allocation and list proliferation. Single SQLite database as source of truth. Kanban-centric with Work Mode for focused deep work including AI chat powered by Claude.

## Core Value

One place for all tasks with focused Work Mode that prevents rabbit-holing on low-priority work.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] SQLite database for tasks, projects, workspace items
- [ ] Project-based organization with colors
- [ ] Kanban board with drag-drop between columns
- [ ] Grouping by status, priority, or due date
- [ ] Filtering by priority, due, tags, blocked, done
- [ ] Task detail view with inline editing
- [ ] Subtasks with independent status
- [ ] Blocked tasks with reason
- [ ] "What Next" prioritization logic
- [ ] Work Mode focused workspace
- [ ] Work Mode AI Chat (spawns Claude CLI with task context)
- [ ] Work Mode Browser tabs (embedded web views)
- [ ] Work Mode Living documents (editable markdown)
- [ ] First launch onboarding
- [ ] User settings (tags, database location)
- [ ] Keyboard shortcuts (n for new task, esc to close)

### Out of Scope

- Claude Code commands / MCP server — app owns data, passes context to Claude
- Tauri — switched to Electron
- Search — v2
- Archive — v2
- Recurring tasks — v2
- Time tracking — v2
- Mobile app — v2
- Export/Import — v2
- Customizable statuses — v2

## Context

Detailed UI spec exists in `SPEC.md`. Covers:
- 3 pages: Kanban Board, Task Detail, Work Mode
- Sidebar with project blobs
- Task card design and interactions
- All modals and popovers
- Right-click menus

Statuses are fixed: inbox, backlog, todo, in_progress, review, done

## Constraints

- **Stack**: Electron + React + SQLite + shadcn/ui + Tailwind
- **AI integration**: Node backend spawns Claude CLI, passes task context, streams response
- **Data**: App reads SQLite, Claude never accesses DB directly

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron over Tauri | Node backend can spawn Claude CLI directly | — Pending |
| App provides context to Claude | Simpler than giving Claude DB access, more control | — Pending |
| shadcn/ui + Tailwind | Accessible components, flexible styling, good DX | — Pending |

---
*Last updated: 2026-01-17 after initialization*
