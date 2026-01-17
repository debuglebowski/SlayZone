# DEPRECATED: Goal-Backward Planning Reference

**This reference has been consolidated into the gsd-planner agent.**

## Migration

Planning expertise is now baked into:
- `agents/gsd-planner.md` - Section: `<goal_backward>`

## Why This Changed

The thin orchestrator pattern consolidates all planning methodology into the agent:
- Before: Reference files loaded separately (~287 lines)
- After: Agent has expertise baked in, orchestrator is thin

## Historical Reference

This file previously contained:
- Goal-backward vs forward planning distinction
- Must-haves derivation process (5 steps)
- Observable truths from user perspective
- Required artifacts mapping
- Required wiring analysis
- Key links identification
- must_haves YAML structure for PLAN.md frontmatter
- Examples (e-commerce, settings, notifications)
- Common failures and anti-patterns

All content preserved in `agents/gsd-planner.md`.

---
*Deprecated: 2026-01-16*
*Replaced by: agents/gsd-planner.md*
