# PR #10 Worktree Follow-Ups

This document captures the remaining work after PR #10 ("Project setting: branch to create new worktrees from") and the immediate hardening patch that followed.

## What PR #10 Introduced

- Project-level `worktree_source_branch`:
  - Empty -> use current/default behavior.
  - Set (example: `main`) -> create new worktrees from that source branch.
- Configurable copy/symlink entries for files/dirs to carry into new worktrees.
- Wiring across:
  - DB migration (`projects.worktree_source_branch`)
  - IPC/API signatures (`git:createWorktree`)
  - Project settings UI
  - Task/worktree creation flows

## Hardening Already Applied In This Branch

- Main-process path containment checks for copy entries:
  - Rejects invalid/empty entries.
  - Rejects absolute paths.
  - Rejects paths that resolve outside repo/worktree roots (`..` traversal).
- Branchless worktree creation now uses detached checkout when a source is provided:
  - `git worktree add --detach <path> <source>`
  - Avoids "branch already used by worktree" failures.
- Project settings copy-entry save behavior improved:
  - Uses current editable `path` value, not only persisted `project.path`.
  - Best-effort key migration when repo path is changed and saved.
- Added regression coverage in worktree handler tests for:
  - branchless + source branch (detached)
  - traversal/escape rejection
  - valid copy entry behavior

## Remaining Gaps (Sustainability)

1. **Path-keyed storage is still fragile**
   - Current key pattern: `worktree_copy_files:<repoPath>`
   - Repo path changes, symlinks, or normalization differences can fragment settings.

2. **Validation is still ad-hoc**
   - Runtime checks exist in `git-worktree.ts`.
   - No shared schema enforcement at settings write/read boundaries.

3. **User feedback for skipped entries is weak**
   - Invalid entries are currently skipped with diagnostics only.
   - UI should surface why an entry was ignored.

## Recommended Follow-Up Plan

### 1) Move copy-entry config to project-id based storage

Preferred options (in order):

- **Option A (recommended):** new DB table
  - `project_worktree_copy_entries(project_id, path, mode, created_at, updated_at)`
  - Strong relational integrity and queryability.
- **Option B:** settings key by project id
  - `worktree_copy_files:project:<projectId>`
  - Lower migration cost but still blob-based.

Migration requirements:

- On read:
  1. Try new project-id source first.
  2. Fallback to old path-key source.
  3. If fallback used, migrate data forward (once) and keep backward compatibility for one release.
- On write:
  - Write only to new project-id source.

### 2) Add shared schema validation

Create a shared parser (zod or equivalent) for:

- `WorktreeCopyEntry`:
  - `path`: non-empty, relative path only, no traversal outside root.
  - `mode`: `'copy' | 'symlink'`.
- `WorktreeCopyEntry[]`:
  - max length guard (reasonable cap, e.g. 100).
  - optional duplicate detection/normalization.

Use this parser in:

- Project settings UI before save.
- Worktree panel UI before save.
- Task/worktree creation read path (defensive parse).
- Main-process create path (final defense-in-depth gate).

### 3) Improve user-visible feedback

When entries are ignored/rejected:

- Show a compact toast summary in UI:
  - example: "2 copy entries were skipped: invalid path"
- Keep diagnostics event payload for deeper debugging.

### 4) Expand tests

Add/extend tests for:

- Migration from path-key -> project-id storage.
- Schema validation (invalid mode/path/empty path/duplicates).
- Behavior when source branch is configured vs empty.
- Copy and symlink happy paths.
- Rejection of traversal and absolute paths.

## Suggested Implementation Areas

- `packages/domains/worktrees/src/main/git-worktree.ts`
  - keep as final trust boundary.
- `packages/domains/projects/src/client/ProjectSettingsDialog.tsx`
  - UI validation + migration-triggered reads/writes.
- `packages/domains/worktrees/src/client/GeneralTabContent.tsx`
  - aligned validation + error surface.
- `packages/domains/task/src/main/handlers.ts`
  - defensive parse when auto-creating worktrees.
- `packages/apps/app/src/main/db/migrations.ts`
  - migration for new project-id storage model (if table/DB route chosen).

## Definition Of Done For Follow-Up

- No worktree copy setting depends on mutable filesystem path as identity.
- Invalid copy entries cannot be persisted silently.
- Users get clear feedback when entries are skipped.
- Regression tests cover:
  - branchless source-branch behavior
  - path escape blocking
  - storage migration path
- Existing users with path-key data continue working without manual intervention.
