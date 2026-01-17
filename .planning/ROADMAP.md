# Roadmap: Focus v1.1

## Overview

Polish all three screens (Kanban, Task Detail, Work Mode) and add cross-cutting features (theme, search, archive). Theme system first since all UI changes depend on it. Screen-specific changes last after core features land.

## Milestones

- **v1.0 MVP** - Phases 1-7 (shipped 2026-01-16)
- **v1.1 UX & Features** - Phases 8-14 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (8.1, 8.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 8: Theme System** - Light/dark/system toggle with persistence
- [x] **Phase 9: Search** - Global search modal across all projects
- [x] **Phase 10: Task Lifecycle** - Archive and delete tasks
- [ ] **Phase 11: Kanban Polish** - Split user menu into buttons
- [ ] **Phase 12: Settings Redesign** - Professional UI with Claude status
- [ ] **Phase 13: Task Screen Redesign** - Narrow layout with metadata sidebar
- [ ] **Phase 14: Work Mode Improvements** - Empty state and sidebar polish

## Phase Details

<details>
<summary>v1.0 MVP (Phases 1-7) - SHIPPED 2026-01-16</summary>

Phases 1-7 delivered complete task management app with kanban board, Work Mode AI chat, browser tabs, and living documents. See archived planning docs for details.

</details>

### v1.1 UX & Features (In Progress)

**Milestone Goal:** Polish all screens and add search + archive functionality.

#### Phase 8: Theme System
**Goal**: App-wide theme support (light/dark/system)
**Depends on**: Nothing (first v1.1 phase)
**Requirements**: THEME-01, THEME-02
**Success Criteria** (what must be TRUE):
  1. User can toggle between light, dark, and system theme
  2. Theme persists across app restarts
  3. System theme changes apply automatically when set to "system"
**Plans**: 2 plans
Plans:
- [x] 08-01-PLAN.md - Wire Electron nativeTheme API through IPC
- [x] 08-02-PLAN.md - Create ThemeContext and settings UI toggle

#### Phase 9: Search
**Goal**: Global search across all projects and tasks
**Depends on**: Phase 8
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04
**Success Criteria** (what must be TRUE):
  1. User can open search modal via keyboard shortcut
  2. Search finds tasks and projects by title
  3. Results display project and task icons to distinguish types
  4. Selecting a result navigates to it
**Plans**: 1 plan
Plans:
- [x] 09-01-PLAN.md - Install shadcn command, create SearchDialog, wire into App.tsx

#### Phase 10: Task Lifecycle
**Goal**: Archive and delete tasks
**Depends on**: Phase 8
**Requirements**: LIFE-01, LIFE-02, LIFE-03
**Success Criteria** (what must be TRUE):
  1. User can archive completed tasks
  2. User can permanently delete tasks
  3. Archived tasks hidden from kanban but recoverable
**Plans**: 2 plans
Plans:
- [x] 10-01-PLAN.md - Migration v4 + archive IPC handlers + types
- [x] 10-02-PLAN.md - Action dropdown in TaskDetailPage + ArchivedTasksView

#### Phase 11: Kanban Polish
**Goal**: Split user menu into dedicated Settings and Tutorial buttons
**Depends on**: Phase 8
**Requirements**: KAN-01, KAN-02
**Success Criteria** (what must be TRUE):
  1. Settings button visible in sidebar footer
  2. Tutorial button visible in sidebar footer
  3. Dropdown menu replaced with direct button access
**Plans**: 1 plan
Plans:
- [ ] 11-01-PLAN.md - Replace dropdown with Settings and Tutorial icon buttons

#### Phase 12: Settings Redesign
**Goal**: Professional settings UI with Claude Code status
**Depends on**: Phase 11
**Requirements**: SET-01, SET-02
**Success Criteria** (what must be TRUE):
  1. Settings UI has professional, polished layout
  2. Claude Code CLI availability status displayed
  3. All existing settings functionality preserved
**Plans**: TBD

#### Phase 13: Task Screen Redesign
**Goal**: Narrow consistent layout with metadata sidebar
**Depends on**: Phase 8
**Requirements**: TASK-01, TASK-02, TASK-03, TASK-04, TASK-05
**Success Criteria** (what must be TRUE):
  1. Task screen uses narrow consistent width
  2. Task screen header has no border
  3. Metadata (status, priority, due, tags, blocked) displayed in right sidebar
  4. Subtasks are clickable and navigate to subtask detail
  5. Subtasks minimized by default
**Plans**: TBD

#### Phase 14: Work Mode Improvements
**Goal**: Empty state improvements and sidebar polish
**Depends on**: Phase 13
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04, WORK-05
**Success Criteria** (what must be TRUE):
  1. Empty state shows 3 workspace options (Chat, Browser, Document)
  2. Empty state hides workspace panel (no blank area)
  3. Task title displayed in sidebar instead of header
  4. Sidebar wider than current design
  5. Exit button subtle and positioned top-right
**Plans**: TBD

## Progress

**Execution Order:** 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v1.0 | - | Complete | 2026-01-16 |
| 8. Theme System | v1.1 | 2/2 | Complete | 2026-01-17 |
| 9. Search | v1.1 | 1/1 | Complete | 2026-01-17 |
| 10. Task Lifecycle | v1.1 | 2/2 | Complete | 2026-01-17 |
| 11. Kanban Polish | v1.1 | 0/1 | Not started | - |
| 12. Settings Redesign | v1.1 | 0/TBD | Not started | - |
| 13. Task Screen Redesign | v1.1 | 0/TBD | Not started | - |
| 14. Work Mode | v1.1 | 0/TBD | Not started | - |

---
*Created: 2026-01-17*
*Milestone: v1.1 UX & Features*
