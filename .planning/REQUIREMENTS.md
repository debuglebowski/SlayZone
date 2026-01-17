# Requirements: Focus v1.1

**Defined:** 2026-01-17
**Core Value:** One place for all tasks with focused Work Mode that prevents rabbit-holing on low-priority work.

## v1.1 Requirements

Requirements for v1.1 release. Each maps to roadmap phases.

### Theme

- [x] **THEME-01**: User can toggle between light, dark, and system theme
- [x] **THEME-02**: App respects system theme preference when set to "system"

### Search

- [x] **SEARCH-01**: User can open search modal via keyboard shortcut
- [x] **SEARCH-02**: User can search across all projects and tasks
- [x] **SEARCH-03**: Search results display both projects and tasks with distinguishing icons
- [x] **SEARCH-04**: User can navigate to selected search result

### Lifecycle

- [x] **LIFE-01**: User can archive completed tasks
- [x] **LIFE-02**: User can permanently delete tasks
- [x] **LIFE-03**: Archived tasks are hidden from kanban but recoverable

### Kanban

- [x] **KAN-01**: Settings accessible via dedicated button (not menu)
- [x] **KAN-02**: Tutorial accessible via dedicated button (not menu)

### Settings

- [x] **SET-01**: Settings UI professionally redesigned
- [x] **SET-02**: Settings shows Claude Code CLI availability status

### Task Screen

- [x] **TASK-01**: Task screen uses narrow consistent width
- [x] **TASK-02**: Task screen header has no border
- [x] **TASK-03**: Metadata sidebar (status, priority, due, tags, blocked) on right side
- [x] **TASK-04**: Subtasks clickable and navigate to subtask detail
- [x] **TASK-05**: Subtasks minimized by default

### Work Mode

- [x] **WORK-01**: Empty state shows 3 workspace options
- [x] **WORK-02**: Empty state hides workspace panel
- [x] **WORK-03**: Task title displayed in sidebar (not header)
- [x] **WORK-04**: Sidebar wider than current
- [x] **WORK-05**: Exit button subtle, positioned top-right

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Notifications

- **NOTF-01**: Reminder notifications for due tasks

### Recurring

- **RECUR-01**: Daily/weekly/monthly recurring tasks

### Natural Language

- **NLP-01**: Natural language task input ("Submit report Friday")

### Calendar

- **CAL-01**: Calendar view of tasks by due date

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Mobile app | Desktop-first, v2+ |
| Time tracking | Complexity, v2+ |
| Export/Import | v2+ |
| Team/collaboration | Single-user by design |
| Customizable statuses | Fixed workflow is opinionated |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| THEME-01 | Phase 8 | Complete |
| THEME-02 | Phase 8 | Complete |
| SEARCH-01 | Phase 9 | Complete |
| SEARCH-02 | Phase 9 | Complete |
| SEARCH-03 | Phase 9 | Complete |
| SEARCH-04 | Phase 9 | Complete |
| LIFE-01 | Phase 10 | Complete |
| LIFE-02 | Phase 10 | Complete |
| LIFE-03 | Phase 10 | Complete |
| KAN-01 | Phase 11 | Complete |
| KAN-02 | Phase 11 | Complete |
| SET-01 | Phase 12 | Complete |
| SET-02 | Phase 12 | Complete |
| TASK-01 | Phase 13 | Complete |
| TASK-02 | Phase 13 | Complete |
| TASK-03 | Phase 13 | Complete |
| TASK-04 | Phase 13 | Complete |
| TASK-05 | Phase 13 | Complete |
| WORK-01 | Phase 14 | Complete |
| WORK-02 | Phase 14 | Complete |
| WORK-03 | Phase 14 | Complete |
| WORK-04 | Phase 14 | Complete |
| WORK-05 | Phase 14 | Complete |

**Coverage:**
- v1.1 requirements: 23 total
- Mapped to phases: 23 ✓
- Unmapped: 0

---
*Requirements defined: 2026-01-17*
*Last updated: 2026-01-17 after initial definition*
