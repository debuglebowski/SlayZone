---
name: gsd:discuss-phase
description: Gather phase context through adaptive questioning before planning
argument-hint: "<phase>"
allowed-tools: [Read, Write, Bash, Glob, Grep, AskUserQuestion]
---

<objective>
Extract implementation decisions that downstream agents need — researcher and planner will use CONTEXT.md to know what to investigate and what choices are locked.

**How it works:**
1. Analyze the phase to identify gray areas (UI, UX, behavior, etc.)
2. Present gray areas — user selects which to discuss
3. Deep-dive each selected area until satisfied
4. Create CONTEXT.md with decisions that guide research and planning

**Output:** `{phase}-CONTEXT.md` — decisions clear enough that downstream agents can act without asking the user again
</objective>

<execution_context>
@./.claude/get-shit-done/references/principles.md
@./.claude/get-shit-done/workflows/discuss-phase.md
@./.claude/get-shit-done/templates/context.md
</execution_context>

<context>
Phase number: $ARGUMENTS (required)

**Load project state:**
@.planning/STATE.md

**Load roadmap:**
@.planning/ROADMAP.md
</context>

<process>
1. Validate phase number (error if missing or not in roadmap)
2. Check if CONTEXT.md exists (offer update/view/skip if yes)
3. **Analyze phase** — Identify domain boundary and gray areas by category
4. **Present gray areas** — Multi-select AskUserQuestion: which to discuss?
5. **Deep-dive each area** — Loop per area until user says "move on"
6. **Write CONTEXT.md** — Structured by decisions made
7. Offer next steps (research or plan)

**CRITICAL: Scope guardrail**
- Phase boundary from ROADMAP.md is FIXED
- Discussion clarifies HOW to implement, not WHETHER to add more
- If user suggests new capabilities: "That's its own phase. I'll note it for later."
- Capture deferred ideas — don't lose them, don't act on them

**Gray area categories (use what's relevant):**
- **UI** — Layout, visual presentation, information density
- **UX** — Interactions, flows, feedback
- **Behavior** — Runtime behavior, state changes
- **Empty/Edge States** — What shows in unusual situations
- **Content** — What information is shown/hidden

**Do NOT ask about (downstream agents handle these):**
- Technical implementation (researcher investigates)
- Architecture choices (planner decides)
- Performance concerns (researcher/planner handle)
- Scope expansion (roadmap defines scope)
</process>

<success_criteria>
- Gray areas identified through intelligent analysis
- User chose which areas to discuss
- Each selected area explored until satisfied
- Scope creep redirected to deferred ideas
- CONTEXT.md captures decisions, not vague vision
- User knows next steps
</success_criteria>
