<purpose>
Define concrete, checkable requirements for v1.

Two modes:
1. **With research** — Transform FEATURES.md into scoped requirements
2. **Without research** — Gather requirements through questioning

This is the bridge between "what's possible/wanted" and "what we're committing to."
</purpose>

<required_reading>
**Read these files NOW:**

1. ./.claude/get-shit-done/templates/requirements.md
2. .planning/PROJECT.md
3. .planning/research/FEATURES.md (if exists)
4. .planning/research/SUMMARY.md (if exists)
</required_reading>

<process>

<step name="detect_mode">
Check for research:
```bash
[ -f .planning/research/FEATURES.md ] && echo "HAS_RESEARCH" || echo "NO_RESEARCH"
```

**If HAS_RESEARCH:** Follow steps load_context → present_features → scope_categories
**If NO_RESEARCH:** Follow steps load_project → gather_requirements → scope_categories
</step>

<step name="load_context" mode="with_research">
Read PROJECT.md and extract:
- Core value (the ONE thing that must work)
- Stated constraints (budget, timeline, tech limitations)
- Any explicit scope boundaries from project definition

Read research/FEATURES.md and extract:
- Table stakes (users expect these)
- Differentiators (competitive advantage)
- Anti-features (commonly requested, often problematic)
- Feature dependencies
- MVP vs full product recommendations

Read research/SUMMARY.md for:
- Overall confidence level
- Key architectural constraints
- Suggested phase structure (informational only)
</step>

<step name="load_project" mode="without_research">
Read PROJECT.md and extract:
- Core value (the ONE thing that must work)
- Stated constraints (budget, timeline, tech limitations)
- Any explicit scope boundaries from project definition
- Any requirements already mentioned in PROJECT.md
</step>

<step name="gather_requirements" mode="without_research">
Since no research exists, gather requirements through conversation.

**Start with core value:**
```
Based on PROJECT.md, the core value is: "[core value]"

What are the main things users need to be able to do?
```

Wait for response. For each capability mentioned:
- Ask clarifying questions to make it specific
- Probe for related capabilities they might need
- Group naturally emerging categories

**Example flow:**
```
User: "Users need to create and share posts"

You: "For posts, what should users be able to include?
- Text only?
- Images?
- Links with previews?

And for sharing — to a feed, or also direct to other users?"
```

Build up a mental feature list organized by category.

**When you have enough:**
Present gathered features in same format as present_features step, then proceed to scope_categories.
</step>

<step name="present_features">
Present features grouped by category (from research or gathered through questioning):

```
Here are the features for [domain]:

## Authentication
**Table stakes:**
- Sign up with email/password
- Email verification
- Password reset
- Session management

**Differentiators:**
- Magic link login
- OAuth (Google, GitHub)
- 2FA

**Research notes:** [any relevant notes from FEATURES.md]

---

## [Next Category]
...
```

For each category, include:
- Table stakes from FEATURES.md
- Differentiators from FEATURES.md
- Any anti-features flagged (with warnings)
- Complexity notes where relevant
</step>

<step name="scope_categories">
For each category, use AskUserQuestion:

- header: "[Category name]"
- question: "Which [category] features are in v1?"
- multiSelect: true
- options:
  - "[Feature 1]" — [brief description or complexity note]
  - "[Feature 2]" — [brief description]
  - "[Feature 3]" — [brief description]
  - "None for v1" — Defer entire category

Repeat for each category from research.

**Track responses:**
- Selected features → v1 requirements
- Unselected table stakes → flag as v2 (users expect these)
- Unselected differentiators → out of scope (unless user specifies v2)
</step>

<step name="identify_gaps">
After scoping all researched categories, ask for additions:

Use AskUserQuestion:
- header: "Additions"
- question: "Any requirements research missed? (Features specific to your vision)"
- options:
  - "No, research covered it" — Proceed to generate
  - "Yes, let me add some" — Capture additional requirements

**If "Yes":**

Ask inline (freeform): "What additional requirements do you need?"

Parse response into requirement format and add to v1 list.
</step>

<step name="validate_core_value">
Cross-check requirements against Core Value from PROJECT.md:

```
Core value: "[from PROJECT.md]"

Requirements that directly support core value:
- [requirement 1]
- [requirement 2]

⚠️ Warning: Core value may not be fully covered by selected requirements.
Missing coverage: [gap description]
```

**If gap detected:**

Use AskUserQuestion:
- header: "Core value"
- question: "Core value '[X]' may need additional requirements. Add coverage?"
- options:
  - "Yes, suggest requirements" — Claude suggests, user confirms
  - "No, it's covered" — Proceed
  - "Adjust core value" — User provides updated core value
</step>

<step name="generate_requirements">
Create `.planning/REQUIREMENTS.md` using template.

**Structure:**
- Header with project name and date
- v1 Requirements grouped by category (checkboxes)
- v2 Requirements (deferred, no checkboxes yet)
- Out of Scope (explicit exclusions with reasoning)
- Traceability section (empty, filled by create-roadmap)

**Requirement format:**
```markdown
### [Category]

- [ ] **[REQ-ID]**: [Requirement description]
- [ ] **[REQ-ID]**: [Requirement description]
```

**REQ-ID format:** `[CATEGORY]-[NUMBER]`
- AUTH-01, AUTH-02
- CONTENT-01, CONTENT-02
- SOCIAL-01, SOCIAL-02

IDs enable traceability from roadmap phases.
</step>

<step name="summarize">
Present the FULL requirements list before committing — not counts, the actual requirements:

```
## v1 Requirements

### [Category 1]
- [ ] **[REQ-ID]**: [Full requirement description]
- [ ] **[REQ-ID]**: [Full requirement description]
- [ ] **[REQ-ID]**: [Full requirement description]

### [Category 2]
- [ ] **[REQ-ID]**: [Full requirement description]
- [ ] **[REQ-ID]**: [Full requirement description]

[... list ALL v1 requirements ...]

---

## v2 (Deferred)

### [Category]
- [REQ-ID]: [Requirement description]
- [REQ-ID]: [Requirement description]

[... list ALL v2 requirements ...]

---

## Out of Scope

- [Feature]: [reason]
- [Feature]: [reason]

[... list ALL exclusions ...]

---

**Core Value:** [from PROJECT.md]
**Alignment:** ✓ Covered / ⚠️ Gaps noted

---

Does this capture what you're building? (yes / adjust)
```

**Critical:** Show every single requirement. The user must see exactly what they're committing to. Counts are useless — list the actual items.

If "adjust": Return to scope_categories or identify_gaps as appropriate.
</step>

<step name="git_commit">
Commit requirements:

```bash
git add .planning/REQUIREMENTS.md
git commit -m "$(cat <<'EOF'
docs: define v1 requirements

[X] requirements across [N] categories.
[Y] requirements deferred to v2.

Core value: [from PROJECT.md]
EOF
)"
```
</step>

<step name="offer_next">
```
Requirements defined:

- Requirements: .planning/REQUIREMENTS.md
- v1 scope: [X] requirements across [N] categories
- v2 deferred: [Y] requirements
- Out of scope: [Z] exclusions

---

## ▶ Next Up

**Create roadmap** — phases mapped to requirements

`/gsd:create-roadmap`

<sub>`/clear` first → fresh context window</sub>

---
```
</step>

</process>

<quality_criteria>
**Good requirements:**
- Specific and testable ("User can reset password via email link")
- User-centric ("User can X" not "System does Y")
- Atomic (one capability per requirement)
- Independent where possible (minimal dependencies)

**Bad requirements:**
- Vague ("Handle authentication")
- Technical implementation ("Use bcrypt for passwords")
- Compound ("User can login and manage profile and change settings")
- Dependent on unstated assumptions
</quality_criteria>

<success_criteria>
- [ ] PROJECT.md core value extracted
- [ ] Features gathered (from research OR conversation)
- [ ] All categories presented to user
- [ ] User scoped each category (v1/v2/out of scope)
- [ ] User had opportunity to add requirements
- [ ] Core value alignment validated
- [ ] REQUIREMENTS.md created with REQ-IDs
- [ ] v1, v2, and out of scope clearly separated
- [ ] Requirements committed to git
</success_criteria>
