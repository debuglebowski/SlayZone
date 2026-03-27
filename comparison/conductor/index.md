---
name: Conductor
slug: conductor
status: active
last_checked: 2026-03-27

primary_category: agent-orchestrator
secondary_categories:
  - desktop-environment

platforms:
  - macos
  # Windows waitlisted per HN/community reports. No Linux. Not yet shipping cross-platform.

workflow_shape: workspace-first
deployment_model: local
provider_model:
  type: multi-provider
  byok: true
  local_models: false

license:
  type: proprietary
  name: Proprietary

pricing:
  model: free
  summary: Free. Future monetization planned via team/collaboration features.

company:
  name: Conductor
  stage: startup
  funding: venture-backed

links:
  website: https://www.conductor.build/
  docs: https://docs.conductor.build/
  pricing: https://docs.conductor.build/account/faq
  changelog: https://changelog.conductor.build/

relevance:
  tier: core
  rationale: Closest direct competitor. Same desktop workspace + multi-agent + worktree positioning as SlayZone, macOS only.

tags:
  - desktop-first
  - multi-agent
  - claude-centric
  - codex-wrapper
  - watch-closely

comparison_axes:
  kanban_board:
    verdict: partial
    confidence: medium
    note: Workspace status lanes (Backlog/In Progress/In Review/Done) since v0.35.0 and tasks since v0.33.0, but no documented drag-and-drop board UX.
    source_ids:
      - changelog-v0.33.0
      - changelog-v0.35.0
    last_checked: 2026-03-27

  real_terminal:
    verdict: yes
    confidence: high
    note: Real PTY execution with user permissions. Big Terminal Mode, terminal tabs, script runner. No sandboxing layer.
    source_ids:
      - docs-faq
      - docs-scripts
      - changelog-v0.8.0
    last_checked: 2026-03-27

  embedded_browser:
    verdict: partial
    confidence: medium
    note: Claude Code for Chrome integration enables agent browsing, screenshots, console access. Not a dedicated per-task embedded browser pane.
    source_ids:
      - changelog-v0.30.0
    last_checked: 2026-03-27

  code_editor:
    verdict: partial
    confidence: medium
    note: v0.37.0 added "Manual Mode" built-in file editor. Diff viewer and review flow remain the primary code surfaces. Not positioned as full IDE replacement.
    source_ids:
      - changelog-v0.37.0
      - docs-diff-viewer
    last_checked: 2026-03-27

  git_worktree_isolation:
    verdict: yes
    confidence: high
    note: Core design primitive. Each workspace maps to a branch/worktree with PR creation and merge lifecycle built in.
    source_ids:
      - docs-workspaces
      - docs-first-workspace
    last_checked: 2026-03-27

  mcp_client:
    verdict: yes
    confidence: high
    note: MCP client support with local/remote transports, server management, health/status UI, reconnection. Context7 and Linear integrations documented.
    source_ids:
      - docs-mcp
      - changelog-v0.34.0
    last_checked: 2026-03-27

  mcp_server:
    verdict: no
    confidence: medium
    note: No evidence Conductor exposes its own MCP server endpoint. It consumes MCP ecosystems, does not publish one.
    source_ids:
      - docs-mcp
    last_checked: 2026-03-27

  multi_provider_agents:
    verdict: partial
    confidence: high
    note: Claude Code and Codex supported. BYOK via OpenRouter, Bedrock, Vertex, Vercel AI Gateway, GLM, Azure. Model traffic routes directly to providers. No local/offline model support.
    source_ids:
      - docs-providers
      - docs-privacy
    last_checked: 2026-03-27

  local_first:
    verdict: partial
    confidence: high
    note: Chat history stored locally. Model traffic direct to providers. But account data in cloud Postgres (Fly.io) and analytics via PostHog.
    source_ids:
      - docs-privacy
    last_checked: 2026-03-27

  native_desktop:
    verdict: yes
    confidence: high
    note: macOS-only desktop app. Bundles its own Claude Code and Codex installations.
    source_ids:
      - website
      - docs-faq
    last_checked: 2026-03-27

  cli_companion:
    verdict: no
    confidence: medium
    note: No separate CLI companion documented.
    source_ids:
      - website
    last_checked: 2026-03-27

  issue_sync:
    verdict: partial
    confidence: medium
    note: Linear integration added in v0.36.5 (open workspace from Linear issue). MCP-based Linear integration documented. Not full two-way sync.
    source_ids:
      - changelog-v0.36.5
      - docs-mcp
    last_checked: 2026-03-27

  pr_review_workflow:
    verdict: yes
    confidence: high
    note: Core feature. Diff viewer, checks tab, editable PR reviews (v0.38.0), merge actions. Review-centric workflow is a primary product pillar.
    source_ids:
      - docs-diff-viewer
      - changelog-v0.38.0
    last_checked: 2026-03-27

  team_collaboration:
    verdict: no
    confidence: medium
    note: Currently single-user. Team/collaboration features mentioned as future monetization vector but not shipped.
    source_ids:
      - docs-faq
    last_checked: 2026-03-27

  mobile_remote:
    verdict: no
    confidence: medium
    note: No mobile or remote companion documented.
    source_ids:
      - website
    last_checked: 2026-03-27

  oss_posture:
    verdict: no
    confidence: high
    note: Closed source. Proprietary. Community trust concern noted in sentiment.
    source_ids:
      - reddit-launch
    last_checked: 2026-03-27

assets:
  - path: assets/product-screenshot.png
    caption: Conductor app UI from homepage. Shows multi-repo sidebar, agent chat center panel, diff/file changes right panel, terminal bottom, and PR merge controls.
    proves: Confirms workspace-centric layout, parallel agent sessions, integrated diff review, real terminal, and PR workflow.
    source_url: https://www.conductor.build/
    captured_on: 2026-03-27

sources:
  - id: website
    label: Conductor homepage
    kind: official
    url: https://www.conductor.build/

  - id: docs-faq
    label: FAQ (pricing, sandboxing, bundled agents)
    kind: official
    url: https://docs.conductor.build/account/faq

  - id: docs-privacy
    label: Privacy and data handling
    kind: official
    url: https://docs.conductor.build/account/privacy

  - id: docs-mcp
    label: MCP client setup and operations
    kind: official
    url: https://docs.conductor.build/core/mcp

  - id: docs-providers
    label: Provider and BYOK configuration
    kind: official
    url: https://docs.conductor.build/advanced/providers

  - id: docs-workspaces
    label: Workspaces and branches
    kind: official
    url: https://docs.conductor.build/core/workspaces-and-branches

  - id: docs-first-workspace
    label: First workspace setup
    kind: official
    url: https://docs.conductor.build/get-started/first-workspace

  - id: docs-diff-viewer
    label: Diff viewer docs
    kind: official
    url: https://docs.conductor.build/core/diff-viewer

  - id: docs-scripts
    label: Scripts and run panel
    kind: official
    url: https://docs.conductor.build/core/scripts

  - id: changelog-v0.8.0
    label: v0.8.0 - Big terminal mode
    kind: official
    url: https://changelog.conductor.build/2025-06-24-conductor-v0.8.0

  - id: changelog-v0.30.0
    label: v0.30.0 - Chrome integration, terminal tabs
    kind: official
    url: https://changelog.conductor.build/2025-09-12-conductor-v0.30.0

  - id: changelog-v0.33.0
    label: v0.33.0 - Tasks feature
    kind: official
    url: https://changelog.conductor.build/2025-10-24-conductor-v0.33.0

  - id: changelog-v0.34.0
    label: v0.34.0 - MCP reconnect, model updates
    kind: official
    url: https://changelog.conductor.build/2025-11-11-conductor-v0.34.0

  - id: changelog-v0.35.0
    label: v0.35.0 - Workspace status lanes
    kind: official
    url: https://changelog.conductor.build/2025-11-17-conductor-v0.35.0

  - id: changelog-v0.36.5
    label: v0.36.5 - Linear integration
    kind: official
    url: https://changelog.conductor.build/2026-02-26-conductor-v0.36.5

  - id: changelog-v0.37.0
    label: v0.37.0 - Manual Mode file editor
    kind: official
    url: https://changelog.conductor.build/2026-03-03-conductor-v0.37.0

  - id: changelog-v0.38.0
    label: v0.38.0 - GPT-5.4, editable PR reviews
    kind: official
    url: https://changelog.conductor.build/2026-03-05-conductor-v0.38.0

  - id: changelog-v0.44.0
    label: v0.44.0 - New sidebar, composer, Codex checkpointing
    kind: official
    url: https://changelog.conductor.build/2026-03-24-conductor-v0.44.0

  - id: reddit-launch
    label: Launch sentiment thread
    kind: community
    url: https://www.reddit.com/r/ClaudeAI/comments/1n3ejhr/conductor_the_first_multiclaude_app/

  - id: reddit-comparison
    label: Tool comparison thread
    kind: community
    url: https://www.reddit.com/r/ClaudeCode/comments/1myad2h/conductor_vs_monospace_vs_opencode_vs_claudia_vs/

  - id: yc-profile
    label: YC company profile
    kind: press
    url: https://www.ycombinator.com/companies/conductor-2

  - id: hn-beehive-thread
    label: HN thread comparing Conductor to Beehive orchestrator
    kind: community
    url: https://news.ycombinator.com/item?id=47170846

  - id: hn-worktree-thread
    label: HN thread on Conductor pioneering worktree workflows
    kind: community
    url: https://news.ycombinator.com/item?id=45520043

  - id: devto-agentic-2026
    label: Dev.to article on agentic development mentioning Conductor
    kind: analysis
    url: https://dev.to/chand1012/the-best-way-to-do-agentic-development-in-2026-14mn

  - id: zencoder-alternatives
    label: Zencoder blog - Conductor alternatives comparison
    kind: analysis
    url: https://zencoder.ai/blog/conductor-alternatives
---

# Conductor

## Summary

Conductor is a macOS desktop app for running multiple AI coding agents (Claude Code, Codex) in isolated workspaces. It is the closest direct competitor to SlayZone, sharing the same desktop-first, workspace-per-branch, multi-agent orchestration positioning. Currently free, closed-source, YC-backed. As of March 2026 at v0.44.0, shipping at extremely high velocity (~30 releases in 6 weeks).

## Positioning

Conductor positions itself as "a team of coding agents on your Mac." The core value proposition is parallel agent orchestration: spin up multiple Claude Code or Codex instances, each in its own git branch/worktree, review diffs, merge results. It is workspace-centric rather than task-centric -- workspaces are the primary organizational unit, with tasks and status lanes added later as workflow scaffolding.

## Best-Fit User or Team

Solo developers or small teams running multiple AI coding agents simultaneously. Best for users who want a dedicated Mac app to orchestrate parallel Claude Code/Codex sessions without managing terminals manually. Less suited for users who need a full task/project management layer, cross-platform support, or strict local-only operation.

## Structured Feature Analysis

### Kanban / Task Board

Conductor added tasks (v0.33.0) and workspace status lanes -- Backlog, In Progress, In Review, Done (v0.35.0). This provides workflow-state management, but official documentation does not describe a drag-and-drop Kanban board with card movement semantics. Community discussion frames Conductor as a parallel-agent launcher and workspace organizer rather than a PM board replacement. Verdict: partial.

### Real Terminal / PTY

Conductor executes commands with full user permissions and explicitly states there is no sandbox layer. Terminal capabilities include Big Terminal Mode (v0.8.0), terminal tabs, and a script runner. The limitation versus SlayZone is isolation granularity: terminals are workspace-scoped, not per-task-scoped. Verdict: yes.

### Embedded Browser

Claude Code for Chrome integration (v0.30.0) enables agents to browse websites, take screenshots, and inspect console logs during workflows. This is integration with Chrome tooling rather than a dedicated in-app embedded browser pane per workspace. Verdict: partial.

### Code Editor / Review Surface

The diff viewer and review pipeline are core features with dedicated shortcuts and checks support. v0.37.0 added "Manual Mode" -- a built-in file editor for direct code changes. There is also an "open in IDE" path for external editors (Cursor, etc.), suggesting Conductor positions itself as an orchestration cockpit with growing editing capability, not a full IDE replacement. Verdict: partial.

### Git Worktree Isolation

This is Conductor's strongest differentiator alongside multi-agent support. Each workspace maps to a git branch/worktree. PR creation, merge lifecycle, and multi-repo support (`/add-dir`) are built into the core workflow. Configurable workspace paths and branch lifecycle operations are well-documented. Directly competitive with SlayZone's worktree isolation. Verdict: yes.

### MCP

Strong MCP client support with local/remote transports, server management, health/status UI, and reconnection improvements. Documented integrations include Context7 and Linear via MCP. No evidence that Conductor exposes its own MCP server endpoint. Conductor consumes MCP ecosystems but does not publish one. Verdict: client yes, server no.

### Multi-Provider Agents

Supports Claude Code and Codex as agent families. BYOK configuration covers OpenRouter, Bedrock, Vertex, Vercel AI Gateway, GLM, and Azure. Model traffic routes directly to providers (no Conductor proxy). Active model cadence includes Opus 4.6, Sonnet 4.6, GPT-5.4, and Codex-Spark variants. No local/offline model runtime support. Breadth is meaningful but not maximally open-ended. Verdict: partial.

## Strengths

- Extremely high development velocity. 30+ releases in 6 weeks as of March 2026.
- Git worktree isolation is a core design primitive, not bolted on.
- Free with no usage limits beyond underlying API costs.
- Direct-to-provider model traffic reduces intermediary trust surface.
- Strong review/diff workflow for agent output inspection.
- Growing feature surface: file editor, Linear integration, enterprise controls.

## Weaknesses

- macOS only. Windows waitlisted, no Linux. Limits addressable market.
- Closed source. Community trust is a persistent, vocal concern.
- Memory and performance pressure at higher session counts.
- Authentication friction (GitHub auth steps) adds onboarding complexity.
- Workspace-centric rather than task-centric -- tasks and status were added late and feel secondary.
- No MCP server exposure -- cannot be consumed by other agents.
- No local/offline model support.
- No team collaboration features shipped yet.
- Market saturation risk: category is crowding and may be subsumed by model providers.

## Pricing and Packaging

Currently free with no announced pricing. FAQ states future monetization will target collaboration/team features. Community cost complaints relate to underlying model API spend, not Conductor subscription pricing.

## Community or Market Signal

### What people praise
- Parallel agent orchestration is the core draw. Users describe Conductor as a "force multiplier" that eliminates dead time between tasks.
- Credited on HN as having "pioneered this whole direction of using git worktrees" for agent workflows.
- Endorsed by engineers at Linear, Vercel, Notion, Stripe (homepage testimonials).
- Dev.to coverage frames it as solving the "dead time" problem: instead of waiting for one agent, run many in parallel across worktrees.

### Top complaints
1. **Closed-source trust**: recurring Reddit and HN concern. "How do we trust it, the code is closed?"
2. **Memory/performance**: pressure at higher session counts. "Would love it to be more performant with multiple active sessions."
3. **Stability**: "Conductor is super slow and buggy" in comparison threads (Reddit, late 2025).
4. **Authentication friction**: GitHub auth steps and pre-execution commands criticized as unnecessary complexity.
5. **UI questioned**: HN developers argue "the terminal UI is good enough" and a full GUI adds complexity without proportional value.
6. **macOS-only**: waitlists for Windows, no Linux. Limits adoption.
7. **Market saturation risk**: HN sentiment that orchestration tools are "the obvious idea" and model providers will eventually subsume the category.

### Market positioning
- Zencoder's "Conductor alternatives" article positions Conductor as the category reference but flags authentication friction, worktree management limitations, and feature immaturity.
- Category is crowding fast: Beehive, Monospace, OpenCode, Claudia, and others entering the same space. HN commenter notes "probably a dozen new ones per week."
- YC-backed, team of ~4 as of January 2026.

## Why It Matters to SlayZone

Conductor is the most direct competitor. It shares SlayZone's core thesis: desktop app, workspace isolation via git worktrees, multi-agent orchestration. Key differentiation for SlayZone: task-centric (not workspace-centric) model, per-task PTY/browser/editor bundles, embedded browser, cross-platform potential, open-source posture, and MCP server exposure. Conductor's high velocity makes it the competitor to watch most closely.

## Sources

Source list lives in frontmatter. Key sources for this record:
- Official docs and FAQ for product facts, privacy model, and pricing status.
- Changelog (changelog.conductor.build) for feature timeline and version history through v0.44.0.
- Reddit threads (r/ClaudeAI, r/ClaudeCode) for launch sentiment and comparison complaints.
- HN threads for developer reception, worktree credit, and market saturation sentiment.
- Dev.to article for practitioner perspective on parallel agent workflows.
- Zencoder alternatives article for third-party competitive framing.
- YC profile for company context and team size.
