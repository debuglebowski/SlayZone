# Requirements: Focus

**Defined:** 2026-01-17
**Core Value:** One place for all tasks with focused Work Mode that prevents rabbit-holing

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Core (CORE)

- [ ] **CORE-01**: SQLite database with tasks, projects, workspace_items tables
- [ ] **CORE-02**: Task CRUD (create, read, update, delete)
- [ ] **CORE-03**: Status workflow (inbox, backlog, todo, in_progress, review, done)
- [ ] **CORE-04**: Projects with name and color
- [ ] **CORE-05**: Blocked tasks with reason field

### Kanban (KANBAN)

- [ ] **KANBAN-01**: Kanban board with columns
- [ ] **KANBAN-02**: Group by status (default)
- [ ] **KANBAN-03**: Group by priority (P1-P5)
- [ ] **KANBAN-04**: Group by due date (Overdue, Today, This Week, Later, No Date)
- [ ] **KANBAN-05**: Drag-drop between columns
- [ ] **KANBAN-06**: Task cards show title, project (when "All"), overdue indicator

### Organization (ORG)

- [ ] **ORG-01**: Subtasks with independent status
- [ ] **ORG-02**: Priority levels (P1-P5, default P3)
- [ ] **ORG-03**: Due dates with overdue indicators
- [ ] **ORG-04**: Tags (multi-select per task)

### Filtering (FILT)

- [ ] **FILT-01**: Filter by priority
- [ ] **FILT-02**: Filter by due date range
- [ ] **FILT-03**: Filter by tags
- [ ] **FILT-04**: Toggle blocked tasks visibility
- [ ] **FILT-05**: Toggle done tasks visibility
- [ ] **FILT-06**: Persist filter state per project

### Task Detail (DETAIL)

- [ ] **DETAIL-01**: Task detail page (no sidebar)
- [ ] **DETAIL-02**: Inline editing for all fields
- [ ] **DETAIL-03**: Markdown description (rendered, click to edit)
- [ ] **DETAIL-04**: Subtasks accordion with add/edit

### Work Mode (WORK)

- [ ] **WORK-01**: Enter Work Mode from task detail
- [ ] **WORK-02**: Workspace sidebar with item list
- [ ] **WORK-03**: AI Chat (spawns Claude CLI, streams response)
- [ ] **WORK-04**: Browser tabs (embedded web views)
- [ ] **WORK-05**: Living documents (markdown editor)
- [ ] **WORK-06**: Add/rename/delete workspace items

### Navigation (NAV)

- [ ] **NAV-01**: Sidebar with project blobs (2-letter + color)
- [ ] **NAV-02**: "All" view across projects
- [ ] **NAV-03**: Project right-click menu (settings, delete)
- [ ] **NAV-04**: Add project modal
- [ ] **NAV-05**: Project settings modal (name, color)
- [ ] **NAV-06**: User settings modal (tags, database path)

### UX (UX)

- [ ] **UX-01**: "What Next" prioritization logic
- [ ] **UX-02**: Keyboard shortcuts (n=new task, esc=back/close)
- [ ] **UX-03**: Add task modal with all fields
- [ ] **UX-04**: First launch onboarding

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Search & Discovery

- **SEARCH-01**: Full-text search across all task fields
- **SEARCH-02**: Search results with highlighting

### Notifications

- **NOTIF-01**: Due date reminders (system notifications)
- **NOTIF-02**: Notification preferences

### Recurring Tasks

- **RECUR-01**: Daily/weekly/monthly/yearly patterns
- **RECUR-02**: Auto-create next occurrence on completion

### Input

- **INPUT-01**: Natural language task entry ("Submit report Friday")

### Views

- **VIEW-01**: Calendar view of tasks by due date

### Data

- **DATA-01**: Export tasks to JSON/CSV
- **DATA-02**: Import tasks from JSON/CSV
- **DATA-03**: Time tracking per task

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Team/collaboration | Solo-focused app, Things 3 proves this works |
| Web app | Desktop-first, Electron only |
| Mobile companion | Defer to post-v1, focus on desktop experience |
| Complex recurring (RRULE) | Simple patterns only, edge cases multiply |
| Gantt charts/dependencies | Overengineering for personal tasks |
| Third-party integrations | Start with 0, add based on demand |
| Customizable statuses | Fixed workflow is simpler and opinionated |
| Gamification | Narrow appeal, focus on intrinsic motivation |
| Location-based reminders | GPS complexity not worth it |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated by roadmap) | | |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 0
- Unmapped: 32

---
*Requirements defined: 2026-01-17*
*Last updated: 2026-01-17 after initial definition*
