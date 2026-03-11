# Copy Ignored Files to New Worktrees

When creating a git worktree, git-ignored files (node_modules, .env, dist, etc.) aren't included. This feature lets users copy selected ignored files from the source repo into the new worktree.

## Flow

1. User clicks "Add worktree" (from General tab or task auto-create)
2. App calls `resolveCopyBehavior(projectId)` — checks project override, then global setting
3. If behavior is `'ask'` → show `CopyFilesDialog` BEFORE creating the worktree
4. If `'all'` or `'custom'` → create worktree + copy automatically
5. If `'none'` → create worktree, skip copy
6. Cancel in dialog = nothing created

## Settings

- **Global**: Settings → Worktrees tab → "Copy ignored files" dropdown
- **Per-project**: Project Settings → Worktrees tab → same dropdown (overrides global)
- Options: `'ask'` (default), `'all'`, `'none'`, `'custom'`
- "Remember for this project" checkbox in dialog persists selection

## Architecture

### Backend (`git-worktree.ts`)
- `getIgnoredFiles(repoPath, prefix?)` — runs `git ls-files --others --ignored --exclude-standard`, groups at requested directory level
- `copyIgnoredFiles(repoPath, worktreePath, 'all' | 'custom', paths[])` — copies files/dirs with path traversal protection

### Backend (`handlers.ts`)
- `resolveCopyBehavior(db, projectId?)` — resolution chain: project column → global setting → `'ask'`
- IPC handlers: `git:getIgnoredFiles`, `git:copyIgnoredFiles`, `git:resolveCopyBehavior`

### Client (`CopyFilesDialog.tsx`)
- Shows ignored files with checkboxes (top-level selection only)
- Folders expandable to browse contents (view-only, no nested selection)
- Pre-selects files, deselects directories

### Client (`useConsolidatedGeneralData.ts`)
- `handleAddWorktree` checks behavior first, shows dialog if `'ask'`
- `handleCopyFilesConfirm` creates worktree + copies + links task
- `handleCopyFilesCancel` closes dialog, nothing created
- Uses `copyFilesDialogRef` to avoid stale closures

## Current Problem: Repeated git calls

`getIgnoredFiles` re-runs `git ls-files` (93k files in this repo) on every call — once for root, once per expanded folder. Each call scans all 93k lines.

## Plan: Server-side tree

1. Replace `getIgnoredFiles(repoPath, prefix?)` with `getIgnoredFileTree(repoPath)` that:
   - Runs `git ls-files` once
   - Builds full nested tree server-side
   - Returns `IgnoredFileNode[]` with `{ name, path, isDirectory, size, fileCount, children }`
   - Only stats root-level files (not nested)
2. Update `IgnoredFileEntry` → `IgnoredFileNode` (add `children`, `name`)
3. Rewrite `CopyFilesDialog` to render the pre-built tree:
   - No IPC calls on expand — just toggle visibility of already-loaded children
   - Remove `LazyTreeRow` and `LazySubtree` (no lazy loading needed)
   - Single recursive `TreeRow` component
4. Update IPC handler, preload, API types
5. Update tests
6. Delete `buildTree.test.ts` (dead stub)

## Key Files

| File | Role |
|------|------|
| `worktrees/src/shared/types.ts` | `IgnoredFileNode` type |
| `worktrees/src/main/git-worktree.ts` | `getIgnoredFileTree`, `copyIgnoredFiles` |
| `worktrees/src/main/handlers.ts` | IPC handlers, `resolveCopyBehavior` |
| `worktrees/src/client/CopyFilesDialog.tsx` | Dialog UI |
| `worktrees/src/client/useConsolidatedGeneralData.ts` | Worktree creation flow |
| `worktrees/src/client/GeneralTabContent.tsx` | Renders dialog |
| `shared/types/src/api.ts` | ElectronAPI type |
| `apps/app/src/preload/index.ts` | IPC bridge |
| `worktrees/src/main/copy-files.test.ts` | Backend tests |

## Constraint

93k files from `git ls-files` — can't send all entries over IPC (Electron silently drops large payloads). Server-side tree grouping reduces to ~10 top-level nodes with nested children.
