# SlayZone Backlog

> Generated from comprehensive codebase analysis after merging PRs #8, #10, #11, #12.
> Current version: **v0.1.69** | 63 E2E specs, ~20 unit test files | Electron 39 + React 19

---

## P0 — Critical (Fix Before Feature Work)

### P0-1: Fix TypeScript Build Toolchain
- **What**: `@typescript/native-preview` (tsgo) binary not linked in `node_modules/.bin` — `pnpm typecheck` broken
- **Where**: Root `package.json`, `.npmrc`, pnpm workspace config
- **Impact**: Blocks all CI and local type validation
- **Action**: Either fix pnpm hoisting/linking or replace `typecheck` script to call `node node_modules/@typescript/native-preview/bin/tsgo.js` directly

### P0-2: Set Up PR CI Pipeline
- **What**: No automated checks on pull requests — merges rely entirely on manual review
- **Where**: `.github/workflows/` (new file)
- **Impact**: Regressions can land unchecked
- **Action**: Create `ci.yml` with: pnpm install → typecheck → unit tests → lint. Use matrix for Node versions.

### P0-3: Fix 9 Broken E2E Merge-Mode Tests
- **What**: Merge-mode spec has 9 `fixme`'d tests that are skipped
- **Where**: `packages/apps/app/e2e/` (merge-mode related specs)
- **Impact**: Terminal merge behavior is untested
- **Action**: Investigate root cause of each failure, fix implementation or tests

### P0-4: Add Tests to Release CI
- **What**: Release workflow builds and publishes but doesn't run tests first
- **Where**: `.github/workflows/release.yml`
- **Impact**: Broken builds can ship
- **Action**: Add test step before build step in release workflow

---

## P1 — High Priority (Core Experience)

### P1-1: Command Palette / Search
- **What**: No quick-access command palette for tasks, projects, or actions
- **Where**: New domain or `packages/shared/ui/`
- **Impact**: Power users have no keyboard-driven navigation
- **Action**: Implement `Cmd+K` / `Ctrl+K` palette with fuzzy search over tasks, projects, commands

### P1-2: Task Dependencies & Blocking
- **What**: Tasks have no dependency relationships — can't model "blocked by" or "depends on"
- **Where**: `packages/domains/task/`, database migration
- **Impact**: No way to express task ordering in complex projects
- **Action**: Add `task_dependencies` table, UI for linking tasks, visual indicators on Kanban

### P1-3: Undo/Redo System
- **What**: No undo for destructive actions (task deletion, status changes)
- **Where**: New shared service, integrate into task/project handlers
- **Impact**: Accidental changes are permanent
- **Action**: Implement command-pattern undo stack with at least 20-step history

### P1-4: Accessibility Audit
- **What**: No ARIA roles, keyboard navigation is incomplete, no screen reader support
- **Where**: All UI components across domains
- **Impact**: App is unusable for assistive technology users
- **Action**: Audit with axe-core, add ARIA labels, ensure full keyboard nav, test with VoiceOver

### P1-5: Resolve 7 Code TODOs
- **What**: Stubs and placeholder code in production paths
- **Where**:
  - `packages/domains/ai-config/src/client/GlobalContextFiles.tsx:66` — global file delete handler
  - `packages/domains/terminal/src/main/adapters/cursor-adapter.ts:78` — Cursor prompt detection
  - `packages/domains/terminal/src/main/adapters/codex-adapter.ts:114` — Codex output format
  - `packages/domains/terminal/src/main/adapters/opencode-adapter.ts:82` — permission overlay
  - `packages/domains/terminal/src/main/pty-manager.ts:551` — shell-specific ready detection
  - `packages/apps/app/src/renderer/src/App.tsx:348` — mode-compare heuristic
  - `packages/apps/app/src/renderer/src/components/tutorial/scenes/SceneBrowser.tsx:33` — docs link placeholder
- **Action**: Implement each TODO or convert to documented known limitation with issue tracking

### P1-6: Worktree Follow-Up: Project-ID Based Storage
- **What**: Copy-entry config uses fragile path-keyed storage that breaks on repo path changes
- **Where**: `packages/domains/worktrees/`
- **Ref**: `followups/PR10_WORKTREE_FOLLOWUPS.md` — Recommended Plan §1
- **Action**: Create `project_worktree_copy_entries` DB table, migrate from path-key to project-id key

### P1-7: Worktree Follow-Up: Shared Schema Validation
- **What**: Worktree copy entry validation is ad-hoc, spread across multiple files
- **Where**: `packages/domains/worktrees/`
- **Ref**: `followups/PR10_WORKTREE_FOLLOWUPS.md` — Recommended Plan §2
- **Action**: Create shared Zod schema for `WorktreeCopyEntry`, use at all boundaries (UI, IPC, main)

### P1-8: Worktree Follow-Up: User Feedback for Skipped Entries
- **What**: Invalid copy entries are silently skipped — user doesn't know why
- **Where**: `packages/domains/worktrees/`
- **Ref**: `followups/PR10_WORKTREE_FOLLOWUPS.md` — Recommended Plan §3
- **Action**: Show toast notifications when entries are skipped with reason

### P1-9: Theme System Polish
- **What**: PR #11 added light/dark theme support — needs polishing across all components
- **Where**: All domain client packages
- **Impact**: Some components may not respect theme variables correctly after merge
- **Action**: Visual audit of every screen in both light and dark themes, fix inconsistencies

---

## P2 — Medium Priority (Differentiation Features)

### P2-1: AI Orchestration Dashboard
- **What**: Real-time view of all AI coding agents across tasks — status, cost, token usage, active file
- **Where**: New domain `packages/domains/ai-dashboard/`
- **Impact**: Key differentiator — no other tool shows multi-agent orchestration at a glance
- **Action**: Aggregate terminal adapter data, build real-time dashboard with cost tracking

### P2-2: Time Tracking
- **What**: No way to track time spent on tasks
- **Where**: `packages/domains/task/`, new `time-tracking` domain
- **Impact**: Developers can't measure productivity or bill time
- **Action**: Add start/stop timer, manual entry, time reports per project

### P2-3: AI Context Management
- **What**: No way to manage/limit what context is sent to AI agents
- **Where**: `packages/domains/ai-config/`
- **Impact**: AI agents may consume excessive tokens or miss relevant context
- **Action**: Context file browser, token budget display, include/exclude patterns per task

### P2-4: Smart Task Generation from Git
- **What**: Auto-create tasks from git commits, branch names, or PR descriptions
- **Where**: `packages/domains/worktrees/`, `packages/domains/task/`
- **Impact**: Reduces manual task creation overhead
- **Action**: Parse branch patterns, detect untracked work, suggest task creation

### P2-5: Session Replay & History
- **What**: No way to review past AI coding sessions
- **Where**: `packages/domains/terminal/`, new storage layer
- **Impact**: Can't learn from or review AI agent interactions
- **Action**: Persist terminal output per session, searchable history viewer

### P2-6: Backup & Sync
- **What**: SQLite database has no backup or cross-device sync
- **Where**: `packages/apps/app/src/main/db/`
- **Impact**: Data loss risk, no multi-device support
- **Action**: Implement automatic backup schedule, optional cloud sync (iCloud/Dropbox folder)

### P2-7: Smart Notifications
- **What**: No system for alerting on AI task completion, errors, or long-running operations
- **Where**: New service, integrate with macOS notifications
- **Impact**: Users must manually check task status
- **Action**: Native notification integration, configurable triggers, sound alerts

### P2-8: Coverage Reporting
- **What**: No coverage collection or reporting exists
- **Where**: Vitest config, CI pipeline
- **Impact**: Can't measure or enforce test quality
- **Action**: Add `vitest --coverage`, configure thresholds, add badge to README

### P2-9: Diff-Aware AI Prompts
- **What**: AI agents don't receive smart context about recent code changes
- **Where**: `packages/domains/terminal/`, adapter layer
- **Impact**: AI wastes tokens rediscovering what changed
- **Action**: Inject recent git diff summary into AI agent prompts automatically

### P2-10: Workspace Snapshots
- **What**: No way to save/restore the full workspace layout (open tasks, panels, terminal states)
- **Where**: New domain or `packages/domains/settings/`
- **Impact**: Losing workspace state on restart is frustrating
- **Action**: Serialize entire workspace state, restore on startup or on-demand

---

## P3 — Low Priority (Future Vision)

### P3-1: Internationalization (i18n)
- **What**: All strings are hardcoded in English
- **Where**: All client packages
- **Action**: Extract strings, set up i18next or similar, start with Swedish + English

### P3-2: Plugin System
- **What**: No extension/plugin architecture
- **Where**: New core infrastructure
- **Action**: Design plugin API for custom terminal adapters, UI panels, task actions

### P3-3: Collaboration / Multi-User
- **What**: Single-user desktop app — no sharing or team features
- **Where**: Architecture-level change
- **Action**: Define collaboration model (real-time vs async), evaluate Convex expansion

### P3-4: Marketplace for AI Agent Configs
- **What**: No way to share/import AI agent configurations between users
- **Where**: New domain
- **Action**: Config export/import format, optional community marketplace

### P3-5: Recurring / Template Tasks
- **What**: No recurring tasks or task templates
- **Where**: `packages/domains/task/`
- **Action**: Add recurrence rules, task template CRUD, auto-create on schedule

### P3-6: Sprint/Cycle Planning
- **What**: Kanban-only — no sprint or cycle planning view
- **Where**: `packages/domains/tasks/`
- **Action**: Add sprint entity, assignment, burndown charts

### P3-7: Multi-Monitor Support
- **What**: Single-window app — no multi-window or detachable panels
- **Where**: Electron main process, window management
- **Action**: Support detaching terminal/browser panels to separate windows

### P3-8: GitHub Deep Integration
- **What**: Basic git integration exists but no PR creation, issue linking, or CI status
- **Where**: `packages/domains/worktrees/`, new GitHub domain
- **Action**: GitHub API integration for PRs, issues, status checks, review requests

---

## Tech Debt & Maintenance

### TD-1: CI Notes Sharp Edges
- **What**: 6 documented CI workarounds in `CI-NOTES.md`
- **Items**:
  - electron-builder v26 OOM → pinned to v25
  - `node-linker=hoisted` required in `.npmrc`
  - Workspace deps must be stripped before electron-builder
  - Electron version must be extracted explicitly
  - Scoped package name breaks `hdiutil` → use `${productName}`
  - Python setuptools required for node-gyp on macOS
- **Action**: Revisit each after electron-builder v26 stabilizes; document in CI config comments

### TD-2: Windows ARM64 Support (Issue #7)
- **What**: GitHub Issue #7 — Windows ARM64 builds not available
- **Where**: `.github/workflows/release.yml`, electron-builder config
- **Action**: Add `win-arm64` target, test on Windows ARM device or CI

### TD-3: Worktree Migration Tests
- **What**: No tests for path-key → project-id storage migration
- **Where**: `packages/domains/worktrees/src/main/`
- **Ref**: `followups/PR10_WORKTREE_FOLLOWUPS.md` — Recommended Plan §4
- **Action**: Write migration tests alongside P1-6 implementation

### TD-4: Expand Unit Test Coverage
- **What**: ~20 unit test files for 15+ domains — coverage gaps in client components
- **Where**: All domain packages
- **Action**: Add tests for untested handlers and hooks, target 80% coverage

### TD-5: Claude Code Switch (CCS) Adapter Hardening
- **What**: PR #12 added CCS support — adapter is new and may need edge case handling
- **Where**: `packages/domains/terminal/src/main/adapters/ccs-adapter.ts`
- **Action**: Add unit tests, handle error cases, verify usage reporting accuracy

### TD-6: Agent List View Mode Testing
- **What**: PR #8 added agent list view — no dedicated tests
- **Where**: `packages/domains/tasks/src/client/AgentListView.tsx`, `AgentListRow.tsx`
- **Action**: Add component tests for list view, verify data binding, test empty states

---

## Implementation Order (Recommended)

### Phase 1: Stabilize (P0)
1. P0-1 — Fix tsgo/typecheck
2. P0-2 — PR CI pipeline
3. P0-3 — Fix broken E2E tests
4. P0-4 — Tests in release CI

### Phase 2: Core Quality (P1 subset)
5. P1-5 — Resolve 7 TODOs
6. P1-6 + P1-7 + P1-8 — Worktree followups (batch)
7. P1-9 — Theme polish
8. P1-4 — Accessibility audit

### Phase 3: Power Features (P1 + P2)
9. P1-1 — Command palette
10. P1-2 — Task dependencies
11. P1-3 — Undo/redo
12. P2-1 — AI orchestration dashboard
13. P2-7 — Smart notifications

### Phase 4: Differentiation (P2)
14. P2-2 — Time tracking
15. P2-3 — AI context management
16. P2-5 — Session replay
17. P2-9 — Diff-aware AI prompts
18. P2-4 — Smart task gen from git

### Phase 5: Polish & Scale (P2 + P3)
19. P2-6 — Backup & sync
20. P2-10 — Workspace snapshots
21. P2-8 — Coverage reporting
22. P3 items as capacity allows

---

*Last updated: auto-generated from codebase analysis*
