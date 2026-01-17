# DEPRECATED: Plan Format Reference

**This reference has been consolidated into the gsd-planner agent.**

## Migration

Planning expertise is now baked into:
- `agents/gsd-planner.md` - Section: `<plan_format>`

## Why This Changed

The thin orchestrator pattern consolidates all planning methodology into the agent:
- Before: Reference files loaded separately (~474 lines)
- After: Agent has expertise baked in, orchestrator is thin

## Historical Reference

This file previously contained:
- PLAN.md frontmatter structure
- XML prompt structure
- Task anatomy (files, action, verify, done)
- Task types (auto, checkpoint:*)
- TDD plans guidance
- Context references and anti-patterns
- Specificity levels (too vague vs just right)
- Task sizing guidance

All content preserved in `agents/gsd-planner.md`.

---
*Deprecated: 2026-01-16*
*Replaced by: agents/gsd-planner.md*
