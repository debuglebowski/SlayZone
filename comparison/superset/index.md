---
name: Superset
slug: superset
status: active
last_checked: 2026-03-27

primary_category: agent-orchestrator
secondary_categories:
  - terminal-multiplexer
  - code-review-tool

platforms:
  - desktop

workflow_shape: workspace-first
deployment_model: hybrid
provider_model:
  type: multi-provider
  byok: true
  local_models: false

license:
  type: source-available
  name: Elastic License 2.0

pricing:
  model: freemium
  summary: Free core product. Pro at $20/seat/month for teams. Enterprise via contact. AI costs are BYOK — no markup.

company:
  name: Superset Inc.
  stage: startup
  funding: bootstrapped (founders are 3 ex-YC CTOs)
  launch_year: 2025

github_stars: 8100
version: v1.4.4

links:
  website: https://superset.sh
  docs: https://docs.superset.sh
  github: https://github.com/superset-sh/superset
  changelog: https://superset.sh/changelog
  enterprise: https://superset.sh/enterprise
  privacy: https://superset.sh/privacy
  team: https://superset.sh/team
  discord: https://discord.gg/cZeD9WYcV7
  twitter: https://x.com/superset_sh

relevance:
  tier: core
  rationale: Closest architectural match to SlayZone — Electron + xterm.js + CodeMirror + SQLite + browser pane + worktrees. Supports 5+ CLI agents. No kanban board (workspace-oriented multiplexer, not PM). Direct positioning overlap on multi-agent orchestration surface.

tags:
  - desktop-first
  - multi-agent
  - worktree-native
  - watch-closely
  - terminal-multiplexer

comparison_axes:
  kanban_board:
    verdict: no
    confidence: high
    note: No visual kanban. Has cloud-synced task table with statuses, priorities, and Linear integration. Workspace sidebar groups by status (In Progress / Ready for Review) but no drag-and-drop board. Task creation from desktop added March 2026.
    source_ids:
      - github-repo
      - changelog-march-23
      - hn-jan-2026
    last_checked: 2026-03-27

  real_terminal:
    verdict: yes
    confidence: high
    note: Real PTY via xterm.js 6.0 + node-pty. Dedicated daemon process for session persistence across crashes. Per-workspace terminals with split panes and configurable presets.
    source_ids:
      - github-repo
      - docs-overview
      - hn-jan-2026
    last_checked: 2026-03-27

  embedded_browser:
    verdict: yes
    confidence: high
    note: Electron Chromium webview, workspace-scoped. 20 reserved ports per workspace for port forwarding. DevTools support added Feb 2026. No mobile emulation.
    source_ids:
      - changelog-feb-16
      - github-repo
    last_checked: 2026-03-27

  code_editor:
    verdict: partial
    confidence: high
    note: Switched from Monaco to CodeMirror (March 9, 2026) — 97% smaller, faster. Side-by-side and inline diffs, hunk-level staging. Positioned as review/staging tool, not IDE replacement. IDE deep-linking (VS Code, Cursor, JetBrains, Xcode, Sublime).
    source_ids:
      - changelog-march-9
      - homepage
    last_checked: 2026-03-27

  git_worktree_isolation:
    verdict: yes
    confidence: high
    note: Automatic worktree creation on workspace create (~2s). Configurable base dirs. Setup/teardown scripts. Port allocation per worktree. No hard capacity limit.
    source_ids:
      - github-repo
      - docs-overview
      - hn-jan-2026
    last_checked: 2026-03-27

  mcp_client:
    verdict: partial
    confidence: medium
    note: Loads MCP servers from .mcp.json. Tools surfaced in Mastra chat. Disabled by default behind env-gated kill switch (SUPERSET_CHAT_MASTRA_MCP_ENABLED=1), suggesting stability issues.
    source_ids:
      - github-repo
    last_checked: 2026-03-27

  mcp_server:
    verdict: yes
    confidence: high
    note: Two MCP servers — @superset/mcp (17 tools, streamable HTTP) for tasks/workspaces/devices, @superset/desktop-mcp (9 tools, stdio) for browser automation. 26 combined tools.
    source_ids:
      - github-repo
    last_checked: 2026-03-27

  multi_provider_agents:
    verdict: yes
    confidence: high
    note: 5+ CLI agents via terminal presets — Claude Code, Codex, Gemini CLI, Cursor Agent, OpenCode. Built-in Mastra chat supports Anthropic and OpenAI models. All BYOK.
    source_ids:
      - homepage
      - github-repo
    last_checked: 2026-03-27

  local_first:
    verdict: partial
    confidence: high
    note: Hybrid two-tier architecture. Local SQLite for projects/workspaces/settings. Cloud Neon PostgreSQL + ElectricSQL for tasks/orgs/presence. Requires login even for local worktree access. Open feature request for offline mode (#1722).
    source_ids:
      - privacy-policy
      - github-issue-1722
      - deepwiki
    last_checked: 2026-03-27

  native_desktop:
    verdict: yes
    confidence: high
    note: Electron 39. macOS primary with DMG installer. Linux AppImage added Feb 2026. Windows planned but not shipped. Download button only shows macOS.
    source_ids:
      - homepage
      - docs-install
    last_checked: 2026-03-27

  cli_companion:
    verdict: no
    confidence: high
    note: No separate CLI tool. Desktop-only product.
    source_ids:
      - homepage
      - docs-overview
    last_checked: 2026-03-27

  issue_sync:
    verdict: partial
    confidence: medium
    note: Linear integration syncs issues as tasks, mirrors comments and attachments. Task schema has external_provider/external_id fields. No other issue tracker integrations confirmed.
    source_ids:
      - github-repo
    last_checked: 2026-03-27

  pr_review_workflow:
    verdict: yes
    confidence: high
    note: Review tab in Changes sidebar (March 23, 2026) for reading/responding to PR comments in-app. Hunk-level staging, commit, push. PR check status inline. Create PRs via gh CLI.
    source_ids:
      - changelog-march-23
      - github-repo
    last_checked: 2026-03-27

  team_collaboration:
    verdict: partial
    confidence: medium
    note: Cloud-synced org/team data via ElectricSQL. Enterprise page with contact form. Device presence tracking. No published team-specific feature gates.
    source_ids:
      - enterprise-page
      - deepwiki
    last_checked: 2026-03-27

  mobile_remote:
    verdict: no
    confidence: high
    note: No mobile app or remote companion. Desktop-only. Cloud VM workspaces mentioned on roadmap but not shipped.
    source_ids:
      - homepage
      - hn-jan-2026
    last_checked: 2026-03-27

  oss_posture:
    verdict: partial
    confidence: high
    note: Source-available under ELv2. README now correctly states ELv2 (previously misrepresented as Apache 2.0). ELv2 prohibits hosted/managed service use — not OSS by OSI definition.
    source_ids:
      - github-repo
      - github-license-pr
    last_checked: 2026-03-27

editorial:
  eyebrow: Head-to-head / core competitor
  title: SlayZone vs Superset.sh
  summary: Same desktop-agent DNA. Different product thesis. SlayZone optimizes for task-first orchestration; Superset optimizes for workspace-first agent execution.
  verdict: Pick SlayZone if you want parallel agent work to stay legible on a board. Pick Superset if you already think in worktrees, terminals, and branch-first desktop shells.
  verdict_tag: Closest architectural competitor
  about_heading: Workspace-first agent execution
  about_kicker: About Superset
  what: Desktop terminal multiplexer for orchestrating parallel CLI coding agents across isolated git worktrees. Workspace-first — the organizational primitive is the worktree, not the task card. Ships with real PTY, CodeMirror diff viewer, embedded browser, and cloud-synced task table.
  strengths:
    - Daemon-based terminal session persistence across crashes — genuinely better than most competitors.
    - Near-daily release cadence (~100+ releases in 5 months) shows strong execution velocity.
    - Two MCP servers (26 tools) provide rich external integration surface.
    - Automatic worktree creation with configurable setup/teardown scripts and port allocation.
    - Enterprise logos (Microsoft, OpenAI, Netflix, Google) suggest real adoption traction.
  weaknesses:
    - Mandatory login for local worktree access — "local-first" marketing is misleading given cloud auth dependency.
    - No kanban board or visual project management — workspace sidebar is not a PM tool.
    - ELv2 license (source-available, not OSS) — was previously misrepresented as Apache 2.0.
    - macOS-primary. Linux via AppImage (Feb 2026), Windows not yet shipped.
    - Mastra chat routes through Fly.io — privacy gap for users expecting local-only operation.
  pick_slayzone:
    - Your work lives on a kanban board — tasks, statuses, subtasks, drag-and-drop.
    - You need the app to run fully offline with no account or cloud sync.
    - You sync issues with Linear, GitHub Issues, or Jira and want them tied to task cards.
    - You want Windows and Linux support, not just macOS.
  pick_competitor:
    - You want terminal sessions to survive app crashes via a persistent daemon process.
    - Your team is already on Clerk auth and cloud-synced tasks via ElectricSQL.
    - You rely on the 26-tool MCP surface for browser automation and task tooling.
    - You want per-workspace port allocation and configurable setup/teardown scripts.
  scorecard_axes:
    - kanban_board
    - local_first
    - real_terminal
    - embedded_browser
    - git_worktree_isolation
    - mcp_server
  slayzone_weaknesses:
    - No daemon-based terminal persistence — Superset's crash-recovery session model is stronger here.
    - Fewer MCP tools (growing) vs Superset's 26-tool surface.
    - No enterprise positioning or team/org features yet.
    - Younger community — smaller star count and less third-party coverage.

assets:
  - path: assets/homepage-hero.png
    caption: Homepage hero showing workspace sidebar, terminal with Claude Code, and changes panel.
    proves: Confirms workspace-oriented UI shape, terminal-first design, and agent orchestration positioning.
    source_url: https://superset.sh
    captured_on: 2026-03-27

sources:
  - id: homepage
    label: Superset homepage
    kind: official
    url: https://superset.sh

  - id: docs-overview
    label: Superset documentation
    kind: official
    url: https://docs.superset.sh/overview

  - id: docs-install
    label: Installation docs
    kind: official
    url: https://docs.superset.sh/installation

  - id: github-repo
    label: GitHub repository
    kind: official
    url: https://github.com/superset-sh/superset

  - id: privacy-policy
    label: Privacy policy
    kind: official
    url: https://superset.sh/privacy

  - id: enterprise-page
    label: Enterprise page
    kind: official
    url: https://superset.sh/enterprise

  - id: changelog-march-23
    label: Changelog — March 23, 2026
    kind: official
    url: https://superset.sh/changelog

  - id: changelog-march-9
    label: Changelog — March 9, 2026 (CodeMirror switch)
    kind: official
    url: https://superset.sh/changelog

  - id: changelog-feb-16
    label: Changelog — Feb 16, 2026 (browser + Linux)
    kind: official
    url: https://superset.sh/changelog

  - id: hn-jan-2026
    label: Show HN — 96 pts, 90 comments
    kind: community
    url: https://news.ycombinator.com/item?id=46368739

  - id: hn-dec-2025
    label: Show HN — 24 pts, 3 comments
    kind: community
    url: https://news.ycombinator.com/item?id=46109015

  - id: deepwiki
    label: DeepWiki architecture analysis
    kind: third-party
    url: https://deepwiki.com/superset-sh/superset

  - id: github-issue-1722
    label: Offline mode feature request
    kind: community
    url: https://github.com/superset-sh/superset/issues/1722

  - id: github-license-pr
    label: ELv2 license change PR
    kind: official
    url: https://github.com/superset-sh/superset/pull/1181
---

# Superset

## Summary

Desktop terminal multiplexer for orchestrating parallel CLI coding agents across isolated git worktrees. Electron app with real PTY, CodeMirror diff viewer, embedded browser, and cloud-synced task table. Closest architectural match to SlayZone but workspace-oriented (not task/kanban-oriented). 3 ex-YC CTO founders, bootstrapped, ~5 months old, 8.1k GitHub stars, shipping near-daily. v1.4.4 as of March 27, 2026.

## Positioning

Superset positions itself as "The Code Editor for AI Agents" — a desktop shell that wraps any CLI agent (Claude Code, Codex, Gemini, etc.) with worktree isolation, diff review, and port management. The thesis is that developers should run many agents in parallel across branches, review results, and merge. It is a terminal multiplexer with code review, not a project management tool.

The homepage leads with "Orchestrate swarms of Claude Code, Codex, etc. in parallel" and enterprise logos (Microsoft, OpenAI, Netflix, Google, etc.). Recent additions include PR review, task creation from desktop, and configurable agent settings — moving toward a more complete workspace product.

## Best-Fit User or Team

Solo developers or small teams who already use CLI agents (especially Claude Code) and want parallel branch isolation with a GUI. Power users comfortable with terminal workflows who want worktree management, diff review, and port forwarding without juggling tmux/git manually. Not a fit for teams wanting kanban-style project management or non-technical stakeholders.

## Structured Feature Analysis

### Kanban / Task Board

No visual kanban board. The workspace sidebar groups workspaces by status (In Progress, Ready for Review) — superficially board-like but flat, no drag-and-drop, no swimlanes. A cloud-synced task table exists with full schema (title, description, priority, assignee, status, labels, due dates) powered by ElectricSQL, but it is secondary to the workspace-first model. Task creation from desktop was added March 23, 2026. Linear integration syncs issues as tasks.

The organizational primitive is the workspace (= git worktree), not the task card. There is no concept of task-scoped isolation — features are per-workspace.

### Real Terminal / PTY

Real PTY via xterm.js 6.0 + node-pty. Standout architecture: a dedicated daemon process manages shell sessions independently of the Electron process, providing crash-recovery session persistence. Per-workspace terminals with split panes (Cmd+D/Cmd+Shift+D), configurable presets (.superset/presets.json), and searchable transcripts. Terminal presets now scoped to individual projects (March 23, 2026).

### Embedded Browser

Electron Chromium webview, workspace-scoped. 20 reserved ports per workspace for port forwarding preview. DevTools support added Feb 2026 per changelog. Context menu added v1.0.1. The @superset/desktop-mcp package (9 tools) exposes the webview to agents for automation. No mobile emulation.

### Code Editor / Review Surface

Switched from Monaco to CodeMirror (March 9, 2026) — ~97% smaller bundle, significantly faster loads. Side-by-side and inline diffs, hunk-level staging, file discard. Positioned as review/staging tool: "Review Changes" panel is core UX. IDE deep-linking (Cmd+O) to VS Code, Cursor, JetBrains, Xcode, Sublime, Finder. Not intended as an IDE replacement.

### Git Worktree Isolation

Automatic worktree creation on workspace create (~2s). Configurable base dirs with per-project overrides. Setup/teardown scripts via .superset/config.json with injected env vars. 20 consecutive ports per workspace to prevent conflicts. Branch auto-naming from task descriptions. No hard capacity limit — port allocation is the practical constraint.

### MCP

Two MCP servers: @superset/mcp (17 tools via streamable HTTP — tasks, workspaces, devices, org) and @superset/desktop-mcp (9 tools via stdio — browser automation: click, navigate, evaluate-js, screenshot, etc.). 26 combined tools.

MCP client loads workspace servers from .mcp.json, but is disabled by default behind an env-gated kill switch (SUPERSET_CHAT_MASTRA_MCP_ENABLED=1), suggesting stability issues. No resource or prompt support — tools only.

### Multi-Provider Agents

Agent-agnostic terminal multiplexer. 5+ CLI agents via presets: Claude Code, Codex, Gemini CLI, Cursor Agent, OpenCode. Built-in Mastra chat supports Anthropic and OpenAI models with BYOK keys. Mastra chat proxied through Fly.io Streams service (messages leave machine). Agent behavior now configurable from desktop settings UI (March 16, 2026).

## Strengths

- Closest architectural match to a full parallel-agent desktop environment — real terminal, browser, editor, worktrees all integrated.
- Daemon-based terminal session persistence across crashes is genuinely better than most competitors.
- Near-daily release cadence (~100+ releases in 5 months) shows strong execution velocity.
- Two MCP servers (26 tools) provide rich external integration surface for orchestration.
- Rapid growth — 2.3k to 8.1k GitHub stars in one month.
- Enterprise logos (Microsoft, OpenAI, Netflix, Google) suggest real adoption traction.

## Weaknesses

- Mandatory login for local worktree access — "local-first" marketing is misleading given cloud auth dependency.
- No kanban board or visual project management — the organizational unit is the workspace, not the task.
- ELv2 license was previously misrepresented as Apache 2.0 (fixed in README, but PR #1181 had empty description).
- macOS-primary — Linux via AppImage (Feb 2026) but Windows not yet shipped. Docs still say "Windows and Linux coming soon."
- Small team (3 engineers) is a sustainability risk in a space with well-funded competitors.
- Mastra chat routes through Fly.io — privacy gap for users expecting local-only operation.
- ~50% of HN commenters skeptical of parallel agent value proposition.

## Pricing and Packaging

Free tier includes core terminal, parallel agent orchestration, worktree isolation, diff viewer, and IDE integration. Pro plan at $20/seat/month for teams (feature gates unclear — no public pricing page, /pricing returns 404). Enterprise via contact form. AI costs are direct BYOK — Superset does not proxy or mark up model usage for CLI agents (Mastra chat does proxy via Fly.io).

Hidden costs: full cloud features require Neon PostgreSQL + Clerk auth (their own infrastructure costs). Mandatory auth for basic usage.

## Community or Market Signal

8,085 GitHub stars. Two HN Show HN posts: Dec 2025 (24 pts, 3 comments, positive) and Jan 2026 (96 pts, 90 comments, ~50% skeptical). Strong Twitter/Discord presence with testimonials from engineers at recognizable companies. Zero Reddit presence — notable for the star count. Growth concentrated in Twitter developer community.

Top complaints: macOS-only (#405 Linux, #499 Windows are most-upvoted issues), cloud dependency despite local marketing (#1722), Electron resource overhead, and skepticism about whether parallel agents solve real problems vs burning tokens.

Testimonials consistently praise worktree UX, session persistence, and agent-first design. Multiple users report switching from Warp, Conductor, and other tools.

## Why It Matters to SlayZone

Superset is the closest architectural competitor — same Electron + xterm.js + SQLite + worktree stack. The key differentiation is organizational model: SlayZone is kanban-first (task cards → isolated workspaces), Superset is workspace-first (worktrees → optional task metadata). SlayZone's kanban board, per-task isolation, and fully local architecture (no login, no cloud sync) are the primary moats. Superset's daemon session persistence, port allocation system, and MCP server breadth are areas where it currently leads.

Watch closely: Superset is shipping fast and gaining traction. If they add a kanban view or improve their task-first UX, the differentiation narrows. Their enterprise push (logo wall, contact form) suggests a team/org positioning that SlayZone doesn't currently target.

## Sources

Source list is in frontmatter. Key sources:
- [Homepage](https://superset.sh) for current positioning and feature claims.
- [GitHub](https://github.com/superset-sh/superset) for license, stars, and code-level verification.
- [Changelog](https://superset.sh/changelog) for March 2026 feature additions (CodeMirror switch, PR review, task creation).
- [HN Show HN](https://news.ycombinator.com/item?id=46368739) for community sentiment and founder statements.
- [DeepWiki](https://deepwiki.com/superset-sh/superset) for architecture analysis of ElectricSQL sync layer.
