# View 6: Rebase Stepper

Commit-by-commit conflict resolution during interactive rebase.
Each step shows which commit is being replayed and its conflicts.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Rebasing feature/auth onto main                              [Abort Rebase]    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─ Commit Timeline ────────────────────────────────────────────────────────┐  │
│  │                                                                          │  │
│  │  ✓ ── ✓ ── ✓ ── ◉ ── ○ ── ○ ── ○                                       │  │
│  │  c1    c2   c3   c4   c5   c6   c7                                       │  │
│  │                   ▲                                                       │  │
│  │                   │                                                       │  │
│  │              CURRENT                                                      │  │
│  │                                                                          │  │
│  │  ✓ c1  abc1234  "Add user model"                    Applied cleanly      │  │
│  │  ✓ c2  def5678  "Add user routes"                   Applied cleanly      │  │
│  │  ✓ c3  ghi9012  "Add auth middleware"               1 conflict resolved  │  │
│  │  ◉ c4  jkl3456  "Wire up router"                   ⚠ 2 conflicts        │  │
│  │  ○ c5  mno7890  "Add tests"                        Pending               │  │
│  │  ○ c6  pqr1234  "Update package.json"              Pending               │  │
│  │  ○ c7  stu5678  "Update README"                    Pending               │  │
│  │                                                                          │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─ Current: c4 jkl3456 "Wire up router" ──────────────────────────────────┐  │
│  │                                                                          │  │
│  │  This commit adds route wiring in createRouter(). Conflicts with main's  │  │
│  │  addition of API middleware in the same function.                         │  │
│  │                                                                          │  │
│  │  Conflicted files:                                                       │  │
│  │                                                                          │  │
│  │    ⚠  src/api/routes.ts         2 hunks    [Resolve ▸]                   │  │
│  │    ⚠  src/api/index.ts          1 hunk     [Resolve ▸]                   │  │
│  │                                                                          │  │
│  │  ┌─ src/api/routes.ts ── Hunk 1/2 ────────────────────────────────┐     │  │
│  │  │                                                                 │     │  │
│  │  │  ◀◀ OURS (rebased so far)    ▸▸ THEIRS (this commit)          │     │  │
│  │  │  ┌───────────────────────┐    ┌───────────────────────────┐    │     │  │
│  │  │  │ router.use('/auth',.. │    │ router.use('/auth', ..    │    │     │  │
│  │  │  │ router.use('/api', .. │    │ router.use('/users', ..   │    │     │  │
│  │  │  │                       │    │ router.use('/protected',..│    │     │  │
│  │  │  └───────────────────────┘    └───────────────────────────┘    │     │  │
│  │  │                                                                 │     │  │
│  │  │  [Accept Ours] [Accept Theirs] [Both] [AI] [Edit Manually]     │     │  │
│  │  └─────────────────────────────────────────────────────────────────┘     │  │
│  │                                                                          │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  [◀ Skip Commit]  [Continue Rebase ▸]  (resolve all conflicts to continue)     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

- **Commit timeline** at top — visual progress through rebase
  - `✓` = applied cleanly or conflicts resolved
  - `◉` = current commit being processed
  - `○` = pending (not yet applied)
- **Commit context** — shows commit message + description of what it does
- **Per-commit conflict list** — only files conflicting in THIS commit
- **Inline hunk resolver** — same resolve UI as other views
- **[Continue Rebase ▸]** — `git rebase --continue` to apply next commit
- **[Skip Commit]** — `git rebase --skip` to drop this commit
- **[Abort Rebase]** — `git rebase --abort` to undo everything
- After continuing, timeline advances and next commit's conflicts (if any) appear

## Note on Ours/Theirs in Rebase

During rebase, "ours" = the branch being rebased ONTO (main + already-applied commits),
"theirs" = the commit being replayed. This is reversed from merge. UI labels should
reflect the actual branch names, not ours/theirs, to avoid confusion:

```
  ◀◀ main (+ applied commits)     ▸▸ feature/auth (commit c4)
```
