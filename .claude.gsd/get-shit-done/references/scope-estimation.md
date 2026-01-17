# DEPRECATED: Scope Estimation Reference

**This reference has been consolidated into the gsd-planner agent.**

## Migration

Planning expertise is now baked into:
- `agents/gsd-planner.md` - Section: `<scope_estimation>`

## Why This Changed

The thin orchestrator pattern consolidates all planning methodology into the agent:
- Before: Reference files loaded separately (~257 lines)
- After: Agent has expertise baked in, orchestrator is thin

## Historical Reference

This file previously contained:
- Quality degradation curve (0-30%, 30-50%, 50-70%, 70%+)
- Context budget targets (~50%)
- Task-per-plan rules (2-3 tasks)
- Split signals (always split, consider splitting)
- Splitting strategies (vertical slices preferred)
- Dependency awareness and wave assignment
- File ownership for parallel execution
- Depth calibration (quick, standard, comprehensive)

All content preserved in `agents/gsd-planner.md`.

---
*Deprecated: 2026-01-16*
*Replaced by: agents/gsd-planner.md*
