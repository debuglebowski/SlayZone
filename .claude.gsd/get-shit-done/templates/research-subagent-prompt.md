# Research Subagent Prompt Template

Template for spawning gsd-researcher agent. The agent contains all research expertise - this template provides research context only.

---

## Template

```markdown
<objective>
Research: {research_question}

Mode: {research_mode}
</objective>

<context>
**Phase:** {phase_number} - {phase_name}
**Description:** {phase_description}

**Requirements:**
{phase_requirements}

**Constraints:**
{constraints_from_state}

**Phase context (if available):**
{context_md_content}
</context>

<output>
Write research findings to: {output_path}
Use RESEARCH.md template structure for phase research.
</output>
```

---

## Placeholders

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{research_question}` | Phase description | `How to implement 3D visualization` |
| `{research_mode}` | Orchestrator sets | `ecosystem` |
| `{phase_number}` | From roadmap | `5` |
| `{phase_name}` | From roadmap | `3d-visualization` |
| `{phase_description}` | From roadmap | `Add interactive 3D model viewer` |
| `{phase_requirements}` | From REQUIREMENTS.md | `VIZ-01: Support GLB format` |
| `{constraints_from_state}` | From STATE.md decisions | `Using React, not Vue` |
| `{context_md_content}` | From CONTEXT.md | User's vision notes |
| `{output_path}` | Generated | `.planning/phases/5-viz/5-RESEARCH.md` |

---

## Usage

**From /gsd:research-phase:**
```python
Task(
  prompt=filled_template,
  subagent_type="gsd-researcher",
  description="Research Phase {phase}"
)
```

---

## Continuation

For checkpoints, spawn fresh agent with:

```markdown
<objective>
Continue research for Phase {phase_number}: {phase_name}
</objective>

<prior_state>
Research file: @{output_path}
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>

<mode>
Continue: {research_mode}
</mode>
```

---

**Note:** Research methodology, tool strategy (Context7 > Official > WebSearch), and verification protocols are baked into the gsd-researcher agent. This template only passes context.
