# Worktrees Domain

Git integration for tasks. Shows git status, branch, and optional worktree per task (1:1).

## Structure

```
src/
├── shared/types.ts       # Worktree, CreateWorktreeInput, DetectedWorktree
├── main/
│   ├── handlers.ts       # IPC handlers for CRUD + git operations
│   └── git-worktree.ts   # Git CLI wrappers
└── client/
    ├── GitPanel.tsx              # Git section in task detail
    ├── WorktreePanel.tsx         # Legacy, use GitPanel
    └── CreateWorktreeDialog.tsx
```

## Database

```sql
CREATE TABLE worktrees (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  branch TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

## IPC Handlers

### Git operations
- `git:isGitRepo(path)` - Check if path is git repo
- `git:init(path)` - Initialize git repo
- `git:getCurrentBranch(path)` - Get current branch name
- `git:detectWorktrees(repoPath)` - List worktrees
- `git:createWorktree(repoPath, targetPath, branch?)` - Create worktree
- `git:removeWorktree(repoPath, worktreePath)` - Remove worktree

### Worktree CRUD
- `db:worktrees:getByTask(taskId)` - Get worktree for task
- `db:worktrees:create(input)` - Create worktree record
- `db:worktrees:update(input)` - Update worktree
- `db:worktrees:delete(id)` - Delete worktree

## GitPanel Features

- Git status check (is repo?)
- Initialize git if not a repo
- Current branch display
- Worktree management (add/remove)
- AI Merge placeholder (coming soon)

## Dependencies

- Uses: none
- Used by: task (GitPanel in TaskDetailPage)
