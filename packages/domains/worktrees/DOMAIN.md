# Worktrees Domain

Git integration for tasks. Shows git status, branch, and optional worktree per task (1:1).

## Structure

```
src/
├── shared/types.ts       # DetectedWorktree, MergeResult
├── main/
│   ├── handlers.ts       # IPC handlers for git operations
│   └── git-worktree.ts   # Git CLI wrappers
└── client/
    ├── GitPanel.tsx              # Git section in task detail
    ├── CreateWorktreeDialog.tsx  # Dialog for creating worktrees
    └── utils.ts                  # slugify helper
```

## Database

Worktree data stored on tasks table:

```sql
-- Columns on tasks table
worktree_path TEXT DEFAULT NULL,
worktree_parent_branch TEXT DEFAULT NULL
```

## IPC Handlers

### Git operations
- `git:isGitRepo(path)` - Check if path is git repo
- `git:init(path)` - Initialize git repo
- `git:getCurrentBranch(path)` - Get current branch name
- `git:detectWorktrees(repoPath)` - List worktrees
- `git:createWorktree(repoPath, targetPath, branch?)` - Create worktree
- `git:removeWorktree(repoPath, worktreePath)` - Remove worktree
- `git:hasUncommittedChanges(path)` - Check for uncommitted changes
- `git:mergeIntoParent(projectPath, parentBranch, sourceBranch)` - Merge branch into parent
- `git:abortMerge(path)` - Abort in-progress merge

## GitPanel Features

- Git status check (is repo?)
- Initialize git if not a repo
- Current branch display
- Worktree management (add/remove)
- Merge to parent branch (completes task + kills terminal)

## Dependencies

- Uses: none
- Used by: task (GitPanel in TaskDetailPage)
