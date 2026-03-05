# Branch Tab — Git Panel

Add a new subtab to the Git Panel for branch overview/management. Different behavior depending on context (Home vs Task).

## Current State

General tab already has: branch switching, creation, checkout, `listBranches` backend, recent commits, ahead/behind for worktrees.

What's missing: full branch inventory, per-branch upstream status, stale detection, branch deletion, visual branch graph, task-vs-parent relationship view.

## Two Contexts

### Home — "Branches" (repo housekeeping)

Full inventory of all branches. Visual tree at top showing divergence from default branch. Branch management (delete, prune remotes, fetch).

```
┌─────────────────────────────────────────────────┐
│  General    Diff    Branches                    │
├─────────────────────────────────────────────────┤
│  🔍 Filter branches...                         │
│                                                 │
│  ●───○───○───●  main (HEAD)                    │
│  │       ↗                                      │
│  ├───○───○───○───●  feature/kanban-dnd  ↑4 ↓7  │
│  │                                              │
│  ├───○───●  fix/terminal-resize         ↑1 ↓3  │
│  │                                              │
│  └───●  stale/old-experiment            ↑0 ↓42 │
│                                                 │
│  LOCAL                                          │
│  ● main ← origin/main              ✓ up to date│
│    a1b2c3 "fix auth flow"  alice         2h ago │
│                                                 │
│  ● feature/kanban-dnd ← origin/feature/kanban.. │
│    d4e5f6 "wip drag drop"  bob     ↑2 ↓5   1d  │
│                                                 │
│  ● fix/terminal-resize  (no upstream)           │
│    g7h8i9 "resize handler" alice        3d ago  │
│                                                 │
│  ● stale/old-experiment  (no upstream)          │
│    j0k1l2 "try new parser" bob         42d ago  │
│                                        [Delete] │
│                                                 │
│  REMOTE (origin) ─────────────── [Fetch] [Prune]│
│  ○ origin/main                                  │
│  ○ origin/feature/kanban-dnd                    │
│  ○ origin/deploy/staging                        │
│  ○ origin/dependabot/npm/lodash-4.17.21         │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Task — "Branch" (singular, focused)

Zoomed into this task's branch vs its parent. Shows your commits, incoming commits, rebase readiness, sibling task branches.

```
┌─────────────────────────────────────────────────┐
│  General    Diff    Branch                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  THIS BRANCH                                    │
│  ● feature/kanban-dnd                           │
│    created from main, 3 days ago                │
│                                                 │
│  VS PARENT (main)                               │
│  ┌───────────────────────────────────────────┐  │
│  │  ↑ 4 commits ahead    ↓ 7 behind         │  │
│  │                                           │  │
│  │  ○───○───○───●  feature/kanban-dnd        │  │
│  │ /         ↗                               │  │
│  │●───○───○───○───○───○───○───●  main        │  │
│  │                                           │  │
│  │            [Rebase onto main]             │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  YOUR COMMITS (4)                               │
│  ○ d4e5f6  "drag drop reorder"         2h ago  │
│  ○ c3b2a1  "kanban column component"   1d ago  │
│  ○ f6e5d4  "add dnd-kit dep"          2d ago   │
│  ○ a1b2c3  "scaffold kanban board"     3d ago  │
│                                                 │
│  INCOMING FROM MAIN (7)                         │
│  ○ 9i8h7g  "fix auth flow"             1h ago  │
│  ○ 6f5e4d  "update deps"               4h ago  │
│  ○ 3c2b1a  "refactor sidebar"         12h ago  │
│  ○ ...4 more                                   │
│                                                 │
│  SIBLING BRANCHES (other tasks)                 │
│  ○ fix/terminal-resize       ↑1 ↓3 vs main     │
│  ○ feature/search-revamp     ↑8 ↓2 vs main     │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Backend Work Needed

Current `listBranches` returns just names. Need to enrich with:
- Last commit per branch (hash, message, author, date)
- Upstream tracking branch
- Ahead/behind upstream counts
- Ahead/behind default branch counts (for tree)
- Merge base / fork point detection

libgit2 (already used in backend) supports all of this natively.

New IPC handlers needed:
- `git:listBranchesDetailed` — enriched branch list
- `git:deleteBranch` — delete local branch (with force option)
- `git:fetchRemote` — fetch from remote
- `git:pruneRemote` — prune stale remote-tracking branches
- `git:branchLog` — commits unique to a branch vs parent

## Design Considerations

### Home tree scalability
- Collapse branches older than N days by default
- Group by prefix (`feature/`, `fix/`, `dependabot/`)
- Cap visible branches, "show N more..."
- Simplified diagram (branch point + tip only) vs actual commit topology

### Tree rendering
- Actual commit topology is expensive and complex to render
- Simplified: just show fork point and tip per branch
- Could use SVG or canvas for the graph, or keep it ASCII/text-based with styled spans

### Tab naming
- Home: "Branches" (plural, full inventory)
- Task: "Branch" (singular, focused on one)

## Unresolved Questions

- Max branches in home tree before collapsing?
- Group by prefix or flat?
- Simplified diagram vs actual commit topology?
- Remote fetch/prune from UI or just display?
- Branch delete: confirm dialog sufficient?
- Build both views simultaneously or start with one?
- Keyboard shortcut for the new tab?
