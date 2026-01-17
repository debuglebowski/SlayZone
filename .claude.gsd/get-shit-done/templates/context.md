# Phase Context Template

Template for `.planning/phases/XX-name/{phase}-CONTEXT.md` - captures implementation decisions for a phase.

**Purpose:** Document decisions that downstream agents need. Researcher uses this to know WHAT to investigate. Planner uses this to know WHAT choices are locked vs flexible.

**Downstream consumers:**
- `gsd-phase-researcher` — Reads decisions to focus research (e.g., "card layout" → research card component patterns)
- `gsd-planner` — Reads decisions to create specific tasks (e.g., "infinite scroll" → task includes virtualization)

---

## File Template

```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<domain>
## Phase Boundary

[Clear statement of what this phase delivers — the scope anchor. This comes from ROADMAP.md and is fixed. Discussion clarifies implementation within this boundary.]

</domain>

<decisions>
## Implementation Decisions

### [Category discussed, e.g., UI]
- [Specific decision made]
- [Another decision if applicable]

### [Category discussed, e.g., Behavior]
- [Specific decision made]

### Claude's Discretion
[Areas where user explicitly said "you decide" — Claude has flexibility here during planning/implementation]

</decisions>

<specifics>
## Specific Ideas

[Any particular references, examples, or "I want it like X" moments from discussion. Product references, specific behaviors, interaction patterns.]

[If none: "No specific requirements — open to standard approaches"]

</specifics>

<deferred>
## Deferred Ideas

[Ideas that came up during discussion but belong in other phases. Captured here so they're not lost, but explicitly out of scope for this phase.]

[If none: "None — discussion stayed within phase scope"]

</deferred>

---

*Phase: XX-name*
*Context gathered: [date]*
```

<good_examples>
```markdown
# Phase 3: Post Feed - Context

**Gathered:** 2025-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Display posts from followed users in a scrollable feed. Users can view posts and see engagement counts. Creating posts and interactions are separate phases.

</domain>

<decisions>
## Implementation Decisions

### UI
- Card-based layout, not timeline or list
- Each card shows: author avatar, name, timestamp, full post content, reaction counts
- Cards have subtle shadows, rounded corners — modern feel
- Show 10 posts initially, load more on scroll

### Behavior
- Infinite scroll, not pagination
- Pull-to-refresh on mobile
- New posts indicator at top ("3 new posts") rather than auto-inserting

### Empty State
- Friendly illustration + "Follow people to see posts here"
- Suggest 3-5 accounts to follow based on interests

### Claude's Discretion
- Loading skeleton design
- Exact spacing and typography
- Error state handling

</decisions>

<specifics>
## Specific Ideas

- "I like how Twitter shows the new posts indicator without disrupting your scroll position"
- Cards should feel like Linear's issue cards — clean, not cluttered
- No infinite scroll fatigue — maybe show "You're all caught up" after ~50 posts

</specifics>

<deferred>
## Deferred Ideas

- Commenting on posts — Phase 5
- Reaction picker (not just counts) — Phase 5
- Bookmarking posts — add to backlog

</deferred>

---

*Phase: 03-post-feed*
*Context gathered: 2025-01-20*
```
</good_examples>

<guidelines>
**This template captures DECISIONS for downstream agents.**

The output should answer: "What does the researcher need to investigate? What choices are locked for the planner?"

**Good content:**
- "Card-based layout, not timeline"
- "Infinite scroll with pull-to-refresh"
- "Show 10 posts initially"
- "New posts indicator rather than auto-insert"

**Bad content (too vague):**
- "Should feel modern and clean"
- "Good user experience"
- "Fast and responsive"
- "Easy to use"

**Sections explained:**

- **Domain** — The scope anchor. Copied/derived from ROADMAP.md. Fixed boundary.
- **Decisions** — Organized by category (UI, UX, Behavior, etc.). Actual choices made.
- **Claude's Discretion** — Explicit acknowledgment of what Claude can decide during implementation.
- **Specifics** — Product references, examples, "like X but..." statements.
- **Deferred** — Ideas captured but explicitly out of scope. Prevents scope creep while preserving good ideas.

**After creation:**
- File lives in phase directory: `.planning/phases/XX-name/{phase}-CONTEXT.md`
- `gsd-phase-researcher` uses decisions to focus investigation
- `gsd-planner` uses decisions + research to create executable tasks
- Downstream agents should NOT need to ask the user again about captured decisions
</guidelines>
