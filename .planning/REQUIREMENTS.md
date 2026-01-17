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

- [ ] **LIFE-01**: User can archive completed tasks
- [ ] **LIFE-02**: User can permanently delete tasks
- [ ] **LIFE-03**: Archived tasks are hidden from kanban but recoverable

### Kanban

- [ ] **KAN-01**: Settings accessible via dedicated button (not menu)
- [ ] **KAN-02**: Tutorial accessible via dedicated button (not menu)

### Settings

- [ ] **SET-01**: Settings UI professionally redesigned
- [ ] **SET-02**: Settings shows Claude Code CLI availability status

### Task Screen

- [ ] **TASK-01**: Task screen uses narrow consistent width
- [ ] **TASK-02**: Task screen header has no border
- [ ] **TASK-03**: Metadata sidebar (status, priority, due, tags, blocked) on right side
- [ ] **TASK-04**: Subtasks clickable and navigate to subtask detail
- [ ] **TASK-05**: Subtasks minimized by default

### Work Mode

- [ ] **WORK-01**: Empty state shows 3 workspace options
- [ ] **WORK-02**: Empty state hides workspace panel
- [ ] **WORK-03**: Task title displayed in sidebar (not header)
- [ ] **WORK-04**: Sidebar wider than current
- [ ] **WORK-05**: Exit button subtle, positioned top-right

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
| LIFE-01 | Phase 10 | Pending |
| LIFE-02 | Phase 10 | Pending |
| LIFE-03 | Phase 10 | Pending |
| KAN-01 | Phase 11 | Pending |
| KAN-02 | Phase 11 | Pending |
| SET-01 | Phase 12 | Pending |
| SET-02 | Phase 12 | Pending |
| TASK-01 | Phase 13 | Pending |
| TASK-02 | Phase 13 | Pending |
| TASK-03 | Phase 13 | Pending |
| TASK-04 | Phase 13 | Pending |
| TASK-05 | Phase 13 | Pending |
| WORK-01 | Phase 14 | Pending |
| WORK-02 | Phase 14 | Pending |
| WORK-03 | Phase 14 | Pending |
| WORK-04 | Phase 14 | Pending |
| WORK-05 | Phase 14 | Pending |

**Coverage:**
- v1.1 requirements: 23 total
- Mapped to phases: 23 ✓
- Unmapped: 0

---
*Requirements defined: 2026-01-17*
*Last updated: 2026-01-17 after initial definition*
