# Roadmap

**Project:** Focus
**Created:** 2026-01-17
**Phases:** 7

## Overview

Phases derived from requirement categories and dependencies. Foundation establishes secure Electron patterns, then data layer enables all features. Navigation/projects before task management (need project context). AI integration separate from Work Mode to isolate complexity. Polish last.

## Phases

### Phase 1: Foundation

**Goal:** Secure Electron shell with IPC patterns and SQLite database initialized
**Depends on:** Nothing
**Requirements:** CORE-01

**Success Criteria:**
1. App launches and displays React UI in Electron window
2. SQLite database created in userData directory with tasks, projects, workspace_items tables
3. Preload script exposes typed IPC API (contextBridge)
4. Security baseline verified: nodeIntegration false, contextIsolation true, sandbox true

**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Scaffold Electron-Vite + Tailwind/shadcn
- [x] 01-02-PLAN.md — Database layer with better-sqlite3
- [x] 01-03-PLAN.md — Typed IPC API + security verification

---

### Phase 2: Data Layer + Task CRUD

**Goal:** Users can create, view, edit, and delete tasks and projects
**Depends on:** Phase 1
**Requirements:** CORE-02, CORE-03, CORE-04, CORE-05

**Success Criteria:**
1. User can create a task with title, description, status, priority, due date
2. User can edit any task field inline
3. User can delete a task
4. User can mark a task as blocked with a reason
5. User can create a project with name and color

**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — Extend IPC layer (update/delete handlers)
- [x] 02-02-PLAN.md — Install shadcn form components + Zod schemas
- [x] 02-03-PLAN.md — Build CRUD UI (task list, dialogs)

---

### Phase 3: Navigation + Projects

**Goal:** Users can navigate between projects and configure the app
**Depends on:** Phase 2
**Requirements:** NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, NAV-06

**Success Criteria:**
1. Sidebar shows project blobs with 2-letter abbreviation and color
2. User can click "All" to see tasks across all projects
3. User can right-click project to access settings or delete
4. User can add new project via modal
5. User can edit project name/color in settings modal
6. User can open user settings and configure tags and database path

**Plans:** 5 plans

Plans:
- [x] 03-01-PLAN.md — Install shadcn components + react-colorful
- [x] 03-02-PLAN.md — Add tags/settings tables + IPC handlers
- [x] 03-03-PLAN.md — Build sidebar with project blobs + All view
- [x] 03-04-PLAN.md — Build project dialogs + context menu
- [x] 03-05-PLAN.md — Build user settings dialog

---

### Phase 4: Task Management

**Goal:** Full task management with kanban, filtering, organization, and detail view
**Depends on:** Phase 3
**Requirements:** KANBAN-01, KANBAN-02, KANBAN-03, KANBAN-04, KANBAN-05, KANBAN-06, ORG-01, ORG-02, ORG-03, ORG-04, FILT-01, FILT-02, FILT-03, FILT-04, FILT-05, FILT-06, DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04

**Success Criteria:**
1. Kanban board displays tasks in columns, grouped by status (default), priority, or due date
2. User can drag-drop tasks between columns
3. User can filter by priority, due date range, tags, blocked, and done
4. Filter state persists per project
5. User can open task detail page with all fields editable inline
6. User can add/edit subtasks with independent status
7. User can add/edit markdown description (rendered view, click to edit)
8. Task cards show title, project color (in All view), overdue indicator

**Plans:** 7 plans

Plans:
- [ ] 04-01-PLAN.md — Install dnd-kit + extend API for subtasks/tags
- [ ] 04-02-PLAN.md — Build kanban board with drag-drop
- [ ] 04-03-PLAN.md — Build filter controls and persistence
- [ ] 04-04-PLAN.md — Integrate filters with kanban + card indicators
- [ ] 04-05-PLAN.md — Build task detail page with markdown
- [ ] 04-06-PLAN.md — Add subtasks feature
- [ ] 04-07-PLAN.md — Human verification checkpoint

---

### Phase 5: AI Integration

**Goal:** Claude CLI spawns from app with task context and streams responses
**Depends on:** Phase 2
**Requirements:** WORK-03

**Success Criteria:**
1. User can open AI chat in Work Mode and send a message
2. App spawns Claude CLI with current task context included
3. Response streams into chat UI character-by-character
4. User can cancel ongoing response
5. Chat history persists in workspace

**Plans:** (created by /gsd:plan-phase)

---

### Phase 6: Work Mode

**Goal:** Users can enter focused workspace with browser tabs and living documents
**Depends on:** Phase 4, Phase 5
**Requirements:** WORK-01, WORK-02, WORK-04, WORK-05, WORK-06

**Success Criteria:**
1. User can enter Work Mode from task detail page
2. Workspace sidebar shows list of items (chat, browser tabs, documents)
3. User can add browser tab by entering URL, page loads in embedded view
4. User can create living document and edit markdown content
5. User can rename or delete any workspace item

**Plans:** (created by /gsd:plan-phase)

---

### Phase 7: Polish + UX

**Goal:** Power user features and first-run experience complete
**Depends on:** Phase 6
**Requirements:** UX-01, UX-02, UX-03, UX-04

**Success Criteria:**
1. "What Next" suggests highest-priority task based on due date, priority, blocked status
2. Keyboard shortcut "n" opens new task modal from anywhere
3. Keyboard shortcut "esc" closes modals or navigates back
4. Add task modal allows setting all fields (title, project, priority, due, tags, description)
5. First launch shows onboarding flow explaining key features

**Plans:** (created by /gsd:plan-phase)

---

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1 - Foundation | Complete | 2026-01-17 |
| 2 - Data Layer | Complete | 2026-01-17 |
| 3 - Navigation | Complete | 2026-01-17 |
| 4 - Task Management | Not started | - |
| 5 - AI Integration | Not started | - |
| 6 - Work Mode | Not started | - |
| 7 - Polish | Not started | - |

---

*Roadmap for milestone: v1.0*
