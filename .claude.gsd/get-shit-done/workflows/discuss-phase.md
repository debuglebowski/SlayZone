<purpose>
Extract implementation decisions that downstream agents need. Analyze the phase to identify gray areas, let the user choose what to discuss, then deep-dive each selected area until satisfied.

You are a thinking partner, not an interviewer. The user is the visionary — you are the builder. Your job is to capture decisions that will guide research and planning, not to figure out implementation yourself.
</purpose>

<downstream_awareness>
**CONTEXT.md feeds into:**

1. **gsd-phase-researcher** — Reads CONTEXT.md to know WHAT to research
   - "User wants card-based layout" → researcher investigates card component patterns
   - "Infinite scroll decided" → researcher looks into virtualization libraries

2. **gsd-planner** — Reads CONTEXT.md to know WHAT decisions are locked
   - "Pull-to-refresh on mobile" → planner includes that in task specs
   - "Claude's Discretion: loading skeleton" → planner can decide approach

**Your job:** Capture decisions clearly enough that downstream agents can act on them without asking the user again.

**Not your job:** Figure out HOW to implement. That's what research and planning do with the decisions you capture.
</downstream_awareness>

<philosophy>
**User = founder/visionary. Claude = builder.**

The user knows:
- How they imagine it working
- What it should look/feel like
- What's essential vs nice-to-have
- Specific behaviors or references they have in mind

The user doesn't know (and shouldn't be asked):
- Codebase patterns (researcher reads the code)
- Technical risks (researcher identifies these)
- Implementation approach (planner figures this out)
- Success metrics (inferred from the work)

Ask about vision and implementation choices. Capture decisions for downstream agents.
</philosophy>

<scope_guardrail>
**CRITICAL: No scope creep.**

The phase boundary comes from ROADMAP.md and is FIXED. Discussion clarifies HOW to implement what's scoped, never WHETHER to add new capabilities.

**Allowed (clarifying ambiguity):**
- "How should posts be displayed?" (layout, density, info shown)
- "What happens on empty state?" (within the feature)
- "Pull to refresh or manual?" (behavior choice)

**Not allowed (scope creep):**
- "Should we also add comments?" (new capability)
- "What about search/filtering?" (new capability)
- "Maybe include bookmarking?" (new capability)

**The heuristic:** Does this clarify how we implement what's already in the phase, or does it add a new capability that could be its own phase?

**When user suggests scope creep:**
```
"[Feature X] would be a new capability — that's its own phase.
Want me to note it for the roadmap backlog?

For now, let's focus on [phase domain]."
```

Capture the idea in a "Deferred Ideas" section. Don't lose it, don't act on it.
</scope_guardrail>

<gray_area_categories>
Use these categories when analyzing a phase. Not all apply to every phase.

| Category | What it clarifies | Example questions |
|----------|-------------------|-------------------|
| **UI** | Visual presentation, layout, information density | "Card-based or list view?" "What info shows on each item?" |
| **UX** | Interactions, flows, feedback | "How does loading work?" "What happens when you tap X?" |
| **Behavior** | Runtime behavior, state changes | "Auto-refresh or manual?" "How does pagination work?" |
| **Empty/Edge States** | What shows in unusual situations | "What appears with no data?" "How do errors display?" |
| **Content** | What information is shown/hidden | "Show timestamps?" "How much preview text?" |

**Categories to AVOID:**
- **Scope** — The roadmap defines scope, not discussion
- **Technical** — You figure out implementation
- **Architecture** — You decide patterns
- **Performance** — You handle optimization
</gray_area_categories>

<process>

<step name="validate_phase" priority="first">
Phase number from argument (required).

Load and validate:
- Read `.planning/ROADMAP.md`
- Find phase entry
- Extract: number, name, description, status

**If phase not found:**
```
Phase [X] not found in roadmap.

Use /gsd:progress to see available phases.
```
Exit workflow.

**If phase found:** Continue to analyze_phase.
</step>

<step name="check_existing">
Check if CONTEXT.md already exists:

```bash
ls .planning/phases/${PHASE}-*/CONTEXT.md 2>/dev/null
ls .planning/phases/${PHASE}-*/${PHASE}-CONTEXT.md 2>/dev/null
```

**If exists:**
Use AskUserQuestion:
- header: "Existing context"
- question: "Phase [X] already has context. What do you want to do?"
- options:
  - "Update it" — Review and revise existing context
  - "View it" — Show me what's there
  - "Skip" — Use existing context as-is

If "Update": Load existing, continue to analyze_phase
If "View": Display CONTEXT.md, then offer update/skip
If "Skip": Exit workflow

**If doesn't exist:** Continue to analyze_phase.
</step>

<step name="analyze_phase">
Analyze the phase to identify gray areas worth discussing.

**Read the phase description from ROADMAP.md and determine:**

1. **Domain boundary** — What capability is this phase delivering? State it clearly.

2. **Gray areas by category** — For each relevant category (UI, UX, Behavior, Empty States, Content), identify 1-2 specific ambiguities that would change implementation.

3. **Skip assessment** — If no meaningful gray areas exist (pure infrastructure, clear-cut implementation), the phase may not need discussion.

**Output your analysis internally, then present to user.**

Example analysis for "Post Feed" phase:
```
Domain: Displaying posts from followed users
Gray areas:
- UI: Layout style (cards vs timeline vs grid)
- UI: Information density (full posts vs previews)
- Behavior: Loading pattern (infinite scroll vs pagination)
- Empty State: What shows when no posts exist
- Content: What metadata displays (time, author, reactions count)
```
</step>

<step name="present_gray_areas">
Present the domain boundary and gray areas to user.

**First, state the boundary:**
```
Phase [X]: [Name]
Domain: [What this phase delivers — from your analysis]

We'll clarify HOW to implement this.
(New capabilities belong in other phases.)
```

**Then use AskUserQuestion (multiSelect: true):**
- header: "Discuss"
- question: "Which areas do you want to discuss?"
- options: Generate 2-4 based on your analysis, each formatted as:
  - "[Category] — [Specific gray area question]"
  - Last option always: "None — you decide, proceed to planning"

**Example options:**
```
☐ UI — Card layout or timeline? How much of each post shows?
☐ Behavior — Infinite scroll or pagination? Pull to refresh?
☐ Empty state — What appears when there are no posts?
☐ None — You decide, proceed to planning
```

If user selects "None": Skip to write_context with minimal context.
Otherwise: Continue to discuss_areas with selected areas.
</step>

<step name="discuss_areas">
For each selected area, conduct a focused discussion loop.

**For each area:**

1. **Announce the area:**
   ```
   Let's talk about [Category].
   ```

2. **Ask focused questions using AskUserQuestion:**
   - header: "[Category]"
   - question: Specific question about that gray area
   - options: 2-3 concrete choices + "Let me describe" + "You decide"

3. **Follow up based on response:**
   - If they chose an option: Capture it, ask if there's more about this area
   - If "Let me describe": Receive their input, reflect it back, confirm understanding
   - If "You decide": Note that Claude has discretion here

4. **Loop control — Always offer:**
   - "Ask more about [Category]" — Continue probing this area
   - "Move to next area" — Done with this category
   - "That's enough, create context" — Done with all discussion

**Scope creep handling:**
If user mentions something outside the phase domain:
```
"[Feature] sounds like a new capability — that belongs in its own phase.
I'll note it as a deferred idea.

Back to [current domain]: [return to current question]"
```

Track deferred ideas internally.

**Continue until:**
- User says "Move to next area" and all selected areas are done, OR
- User says "That's enough, create context"
</step>

<step name="write_context">
Create CONTEXT.md capturing decisions made.

**File location:** `.planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md`

Zero-pad the phase number: `PADDED_PHASE=$(printf "%02d" ${PHASE})`

Create phase directory if it doesn't exist. Use roadmap phase name for slug (lowercase, hyphens).

**Structure the content by what was discussed:**

```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<domain>
## Phase Boundary

[Clear statement of what this phase delivers — the scope anchor]

</domain>

<decisions>
## Implementation Decisions

### [Category 1 that was discussed]
- [Decision or preference captured]
- [Another decision if applicable]

### [Category 2 that was discussed]
- [Decision or preference captured]

### Claude's Discretion
[Areas where user said "you decide" — note that Claude has flexibility here]

</decisions>

<specifics>
## Specific Ideas

[Any particular references, examples, or "I want it like X" moments from discussion]

[If none: "No specific requirements — open to standard approaches"]

</specifics>

<deferred>
## Deferred Ideas

[Ideas that came up but belong in other phases. Don't lose them.]

[If none: "None — discussion stayed within phase scope"]

</deferred>

---

*Phase: XX-name*
*Context gathered: [date]*
```

Write file.
</step>

<step name="confirm_creation">
Present summary and next steps:

```
Created: .planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## Decisions Captured

### [Category]
- [Key decision]

### [Category]
- [Key decision]

[If deferred ideas exist:]
## Noted for Later
- [Deferred idea] — future phase

---

## ▶ Next Up

**Phase ${PHASE}: [Name]** — [Goal from ROADMAP.md]

`/gsd:plan-phase ${PHASE}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:plan-phase ${PHASE} --skip-research` — plan without research
- Review/edit CONTEXT.md before continuing

---
```
</step>

<step name="git_commit">
Commit phase context:

```bash
git add .planning/phases/${PHASE}-${SLUG}/${PHASE}-CONTEXT.md
git commit -m "$(cat <<'EOF'
docs(${PHASE}): capture phase context

Phase ${PHASE}: ${PHASE_NAME}
- Implementation decisions documented
- Phase boundary established
EOF
)"
```

Confirm: "Committed: docs(${PHASE}): capture phase context"
</step>

</process>

<success_criteria>
- Phase validated against roadmap
- Gray areas identified through intelligent analysis (not generic questions)
- User selected which areas to discuss
- Each selected area explored until user satisfied
- Scope creep redirected to deferred ideas
- CONTEXT.md captures actual decisions, not vague vision
- Deferred ideas preserved for future phases
- User knows next steps
</success_criteria>
