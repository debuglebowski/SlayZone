# E2E Test Plan

## Batch 1: High Value / Low Complexity

1. [x] **Keyboard shortcuts** — Cmd+1-9 tab switching, Ctrl+Tab cycling, Cmd+Shift+T reopen closed tab → `16-tab-management.spec.ts`
2. [x] **Create task dialog** — full form with priority, tags, due date, status → `11-create-task-dialog.spec.ts`
3. [x] **Task metadata editing** — change status/priority/due date/tags from detail sidebar → `11-create-task-dialog.spec.ts`
4. [x] **Tag management** — create/edit/delete tags in settings, assign to tasks, filter by tag → `12-tags.spec.ts`
5. [x] **Priority & due date filters** — filter bar dropdowns on kanban → `13-filters-advanced.spec.ts`
6. [x] **Group by** — switch kanban grouping (status, priority, due date, tags) → `13-filters-advanced.spec.ts`
7. [x] **Project settings** — edit name, color, path via project settings dialog → `14-project-settings.spec.ts`
8. [x] **Inline project rename** — via project settings dialog → `14-project-settings.spec.ts`
9. [x] **Archive/delete from detail dropdown** — vs only via API as currently tested → `15-task-detail-actions.spec.ts`

## Batch 2: Medium Value / Medium Complexity

10. [x] **Kanban drag & drop** — move card between columns, verify status change → `18-kanban-interactions.spec.ts`
11. [x] **Panel toggles** — Cmd+T/B/G/S toggle terminal/browser/git/settings panels in task detail → `19-panel-toggles.spec.ts`
12. [x] **Complete task flow** — Cmd+Shift+D complete + close tab confirmation dialog → `15-task-detail-actions.spec.ts`
13. [x] **Quick run dialog** — Cmd+Shift+N opens dialog → `16-tab-management.spec.ts`
14. [x] **Notification panel** — toggle open/close, empty state, filter buttons → `20-notification-panel.spec.ts`
15. [x] **Desktop notifications toggle** — enable/disable toggle + persistence → `20-notification-panel.spec.ts`
16. [x] **Multiple task tabs** — open several tasks, verify tab bar, close individual tabs → `16-tab-management.spec.ts`

## Batch 3: High/Medium Value (Second Wave)

17. [x] **Persistence across restart** — theme setting persists after refresh → `17-multi-project.spec.ts`
18. [x] **Error states** — project path not found shows warning, fix path restores kanban → `21-error-states.spec.ts`
19. [x] **Multi-project task isolation** — tasks only show under their project, switching projects changes kanban → `17-multi-project.spec.ts`
20. [x] **Bulk operations** — archive all done tasks via API → `18-kanban-interactions.spec.ts`
21. [x] **Sidebar context menu** — right-click project blob, verify options work → `14-project-settings.spec.ts`
22. [x] **Search edge cases** — no results message, search across projects → `17-multi-project.spec.ts`
23. [x] **Tab management edge cases** — opening same task twice doesn't duplicate tab → `16-tab-management.spec.ts`
24. [x] **Due date behavior** — overdue task styling on kanban → `18-kanban-interactions.spec.ts`
25. [x] **Blocked task indicators** — blocked tasks show visual indicator on kanban cards → `18-kanban-interactions.spec.ts`
26. [x] **Empty column states** — columns with no tasks show appropriate state → `17-multi-project.spec.ts`
27. N/A **Window state persistence** — app does not persist window size/position (only tab/filter state, tested in #17)
28. [x] **Concurrent edits** — edit task title, switch away, switch back, changes persisted → `18-kanban-interactions.spec.ts`

## Batch 4: Lower Priority / Higher Complexity

29. [x] **Terminal mode switching** — switch between Claude Code/Codex/Terminal modes → `22-terminal-mode-switching.spec.ts`
30. [x] **Git worktree operations** — create worktree, verify branch, delete (needs git repo fixture) → `23-git-worktree.spec.ts`
31. [x] **Rich text description** — TipTap editor interactions → `24-rich-text-description.spec.ts`
32. [x] **Browser panel** — open URL, tab navigation → `25-browser-panel.spec.ts`
33. [x] **Panel resize** — drag resize handles, verify persistence → `26-panel-resize.spec.ts`
34. [x] **AI description generation** — mock or skip (depends on external API) → `27-ai-description.spec.ts`
