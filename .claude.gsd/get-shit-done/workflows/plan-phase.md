# DEPRECATED: Plan-Phase Workflow

**This workflow has been consolidated into the gsd-planner agent.**

## Migration

Planning expertise is now baked into:
- `agents/gsd-planner.md` - Complete planning methodology

The `/gsd:plan-phase` command spawns the gsd-planner agent directly.

## Why This Changed

The thin orchestrator pattern reduces main context usage:
- Before: ~3,580 lines loaded into main context
- After: ~150 lines in orchestrator, expertise in agent

## Historical Reference

This file previously contained:
- Decimal phase numbering rules
- Required reading list (8 reference files)
- Planning principles and philosophy
- Discovery level definitions (Level 0-3)
- Project history assembly via frontmatter dependency graph
- Gap closure mode process
- Task breakdown with TDD detection
- Dependency graph building
- Wave assignment algorithm
- Plan grouping rules
- Scope estimation and depth calibration
- Phase prompt writing (PLAN.md structure)
- User setup frontmatter for external services
- Git commit step
- Success criteria (standard and gap closure modes)

All content preserved in `agents/gsd-planner.md`.

---
*Deprecated: 2026-01-16*
*Replaced by: agents/gsd-planner.md*
