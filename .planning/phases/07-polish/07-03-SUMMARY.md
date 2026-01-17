---
phase: 07-polish
plan: 03
subsystem: ui
tags: [prioritization, useMemo, react-hooks, date-fns]

# Dependency graph
requires:
  - phase: 04-task-management
    provides: Task entity and status field
provides:
  - Priority scoring algorithm with due date urgency
  - useWhatNext hook for task suggestions
  - Header "Next:" UI element
affects: [onboarding, future-ai-suggestions]

# Tech tracking
tech-stack:
  added: []
  patterns: [priority-scoring, memoized-derived-state]

key-files:
  created:
    - src/renderer/src/lib/prioritization.ts
    - src/renderer/src/hooks/useWhatNext.ts
  modified:
    - src/renderer/src/App.tsx

key-decisions:
  - "Priority score formula: (6-priority)*200 + dueDateScore + statusScore"
  - "Overdue tasks get 500-1000 bonus (capped)"
  - "In-progress tasks get +100, review +75, todo +50"

patterns-established:
  - "Priority scoring: base + urgency + status model"

# Metrics
duration: 6min
completed: 2026-01-17
---

# Phase 7 Plan 3: What Next Prioritization Summary

**Priority scoring algorithm suggests highest-value task based on P1-P5, due date urgency, and status**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-17T13:45:13Z
- **Completed:** 2026-01-17T13:51:16Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Priority scoring with P1=1000...P5=200 base scores
- Due date urgency: overdue +500-1000, today +400, soon +150-300, this week +100
- Status boost: in_progress +100, review +75, todo +50
- "Next: [task]" clickable UI in kanban header

## Task Commits

Each task was committed atomically:

1. **Task 1: Create prioritization logic** - Already committed (prior work)
2. **Task 2: Create useWhatNext hook** - `df639cd` (feat)
3. **Task 3: Add What Next UI to header** - `f8720f6` (feat)
4. **Fix: Enable whatNextTask hook** - `0016876` (fix)

## Files Created/Modified
- `src/renderer/src/lib/prioritization.ts` - Priority scoring algorithm (calculatePriorityScore, getNextTask)
- `src/renderer/src/hooks/useWhatNext.ts` - Memoized hook wrapping getNextTask
- `src/renderer/src/App.tsx` - Header "Next:" display with click-to-detail

## Decisions Made
- Priority formula: (6-priority)*200 gives P1=1000, P5=200
- Overdue boost capped at +1000 to prevent runaway scores
- Blocked and done tasks excluded via -Infinity score

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed commented-out hook call**
- **Found during:** Task 3 verification
- **Issue:** External process (linter?) commented out the import and hook call
- **Fix:** Committed additional fix to uncomment the lines
- **Files modified:** src/renderer/src/App.tsx
- **Verification:** npm run typecheck passes
- **Committed in:** 0016876

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor fix to complete the integration

## Issues Encountered
- Task 1 (prioritization.ts) was already implemented in prior work - skipped redundant creation

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- What Next feature complete and functional
- Clicking suggestion navigates to task detail
- Ready for onboarding and polish phases

---
*Phase: 07-polish*
*Completed: 2026-01-17*
