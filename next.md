# omgslayzone Implementation Plan

## Phase 1: Cleanup - Remove Unused Features ✓

### Database
- [x] Remove workspace_items table
- [x] Remove chat_messages table
- [x] Remove task fields: parent_id, blocked_reason, recurrence_type, recurrence_interval, last_reset_at, next_reset_at, last_active_workspace_item_id

### Components to Delete
- [x] Browser tab components
- [x] Document editor components (TipTap)
- [x] Dumper panel
- [x] Work mode page
- [x] Chat panel/components
- [x] useClaude hook (will rebuild for terminal)

### IPC Handlers to Remove
- [x] workspaceItems handlers
- [x] chatMessages handlers
- [x] claude streaming handlers (will rebuild)

### Dependencies to Remove
- [x] @tiptap/* packages (kept task-item/task-list for rich text)
- [x] Chat-related dependencies

## Phase 2: Database Changes ✓

- [x] Add `path` field to projects table
- [x] Add `claude_session_id` field to tasks table (nullable)
- [x] Create `task_dependencies` table (task_id, blocks_task_id)
- [x] Write migration script

## Phase 3: Type Updates ✓

- [x] Update Project type (add path)
- [x] Update Task type (add claude_session_id, remove old fields)
- [x] Add TaskDependency type
- [x] Update API types
- [x] Remove WorkspaceItem, ChatMessage types (done in Phase 1)

## Phase 4: Terminal Infrastructure ✓

### Dependencies
- [x] Install node-pty
- [x] Install xterm.js + xterm-addon-fit + xterm-addon-web-links

### Main Process
- [x] Create PTY manager (Map of task_id → PTY)
- [x] IPC: pty.create(taskId, cwd, sessionId?)
- [x] IPC: pty.write(taskId, data)
- [x] IPC: pty.resize(taskId, cols, rows)
- [x] IPC: pty.kill(taskId)
- [x] IPC: pty.exists(taskId)
- [x] Event: pty.onData(taskId, data)

### Renderer
- [x] Create Terminal component (xterm.js wrapper)
- [x] Handle resize with fit addon
- [x] Reconnect to existing PTY on mount
- [x] Create on first mount if no PTY exists

## Phase 5: UI Updates ✓

### Project
- [x] Add path field to project create/edit dialog
- [x] Path picker (folder select)

### Task Detail Page
- [x] Convert to split view (info left | terminal right)
- [x] Embed Terminal component
- [x] Auto-start Claude Code on terminal mount
- [x] Pass project path as cwd

### Kanban Card
- [x] Add blocked-by indicator (chain icon)
- [x] Query task dependencies for display

### Task Dependencies
- [x] Add "blocked by" field to task detail sidebar
- [x] Task selector for dependencies
- [x] IPC handlers for dependencies CRUD

## Phase 6: Session Management ✓

- [x] Generate UUID on first terminal open
- [x] Save claude_session_id to task
- [x] Use --session-id for new, --resume for existing
- [x] Handle Claude Code not installed gracefully
- [x] Handle stale session IDs (detect "No conversation found", clear + restart)

## Phase 7: Polish ✓

- [x] Update onboarding flow (mention terminal feature)
- [x] Update keyboard shortcuts (already Cmd+N, Cmd+K, Esc)
- [x] Clean up unused code (removed claude-spawner.ts, streaming handlers)
- [ ] Test concurrent terminals
- [ ] Test session resume after app restart
