# Commit Graph Unification

## Background

Commit history was rendered 3 different ways across the app: duplicated flat commit lists, a fork graph (`BranchGraph mode="tips"`), and a full DAG (`BranchGraph mode="dag"`).

## What we did

### 1. Rename + cleanup

- `BranchGraph.tsx` → `CommitGraph.tsx`, export `BranchGraph` → `CommitGraph`, mode `'tips'` → `'fork'`
- Deleted dead `BranchTab.tsx`

### 2. CommitGraph everywhere

Instead of keeping a separate `CommitList` for flat commit rows, we unified all commit rendering under `CommitGraph`:
- Single-column `CommitGraph mode="fork"` replaces flat lists (recent commits, no divergence)
- Two-column fork graph shows local vs remote divergence

### 3. Local vs remote divergence

Added upstream tracking visualization:
- `useConsolidatedGeneralData` fetches `getMergeBase` + `getCommitsSince` for `branch@{upstream}` when ahead/behind
- `ProjectGeneralTab` does the same inline
- When diverged: fork graph with column 0 = `origin/branch`, column 1 = local branch
- When not diverged: single column of recent commits

### 4. `buildForkGraphNodes` helper

Extracted shared fork-graph-building logic into `CommitGraph.tsx`:

```ts
buildForkGraphNodes({
  column0Commits, column0Label,
  column1Commits, column1Label,
  forkPoint, preForkCommits,
  column1EmptyMessage?  // e.g. "3 files changed (uncommitted)"
}): { nodes: GraphNode[]; columns: number }
```

Used in 3 places:
- `useConsolidatedGeneralData` — worktree fork graph (task branch vs parent)
- `useConsolidatedGeneralData` — upstream graph (local vs origin)
- `ProjectGeneralTab` — upstream graph (local vs origin)

## Final file state

| File | Status |
|------|--------|
| `CommitGraph.tsx` | Renamed from BranchGraph. Exports `CommitGraph`, `GraphNode`, `buildForkGraphNodes` |
| `GeneralTabContent.tsx` | Uses `CommitGraph` via `data.upstreamGraphNodes` |
| `ProjectGeneralTab.tsx` | Uses `CommitGraph` + `buildForkGraphNodes` inline |
| `useConsolidatedGeneralData.ts` | Builds both worktree + upstream graph nodes via `buildForkGraphNodes` |
| `BranchesTab.tsx` | Uses `CommitGraph mode="dag"` (unchanged) |
| `BranchGraph.tsx` | Deleted |
| `BranchTab.tsx` | Deleted |
| `CommitList.tsx` | Deleted (never needed — CommitGraph handles all cases) |
