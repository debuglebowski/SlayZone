# View 1: Conflict Dashboard

Bird's eye view. Entry point after merge detects conflicts.
Shows all conflicted files, progress, and bulk actions.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ⚠ Merge Conflicts — feature/auth → main          [Abort Merge] [AI Resolve All]│
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Progress: ████████░░░░░░░░░░░░ 3/8 files resolved                             │
│                                                                                 │
│  ┌─ Resolved ──────────────────────────────────────────────────────────────┐    │
│  │  ✓  src/auth/login.ts             ours     Manual         12 lines     │    │
│  │  ✓  src/auth/types.ts             theirs   Auto           4 lines      │    │
│  │  ✓  package.json                  merged   AI-assisted    2 lines      │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  ┌─ Unresolved (5) ───────────────────────────────────────────────────────┐    │
│  │                                                                        │    │
│  │  ◉  src/api/routes.ts            3 hunks   +45 -23   [Open ▸]         │    │
│  │     └ AI suggestion ready — "Add both route groups, fix import order"  │    │
│  │                                                                        │    │
│  │  ○  src/db/migrations.ts         1 hunk    +12 -8    [Open ▸]         │    │
│  │     └ Analyzing...                                                     │    │
│  │                                                                        │    │
│  │  ○  src/components/App.tsx        2 hunks   +31 -15   [Open ▸]         │    │
│  │                                                                        │    │
│  │  ○  src/utils/helpers.ts          1 hunk    +5  -5    [Open ▸]         │    │
│  │                                                                        │    │
│  │  ○  README.md                     1 hunk    +3  -1    [Open ▸]         │    │
│  │                                                                        │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  ┌─ Quick Actions ────────────────────────────────────────────────────────┐    │
│  │  [Accept All Ours]  [Accept All Theirs]  [AI Resolve Remaining]        │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│                                              [Complete Merge] (disabled: 5 left)│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

- **Progress bar** at top — immediate sense of how much is left
- **Resolved section** collapses as it grows (most recent on top)
- **Unresolved section** shows per-file: hunk count, line delta, AI status
- **AI suggestion ready** badge when background analysis completes
- **Quick Actions** for bulk resolution (ours/theirs/AI for all remaining)
- **Complete Merge** button disabled until all resolved
- Clicking [Open ▸] navigates into the file-level views (02-07)
