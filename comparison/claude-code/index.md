---
name: Claude Code
slug: claude-code
status: active
last_checked: 2026-03-27

primary_category: cli-agent
secondary_categories:
  - agent-sdk
  - desktop-environment

platforms:
  - macos
  - linux
  - windows
  - web
  - mobile

workflow_shape: cli-first
deployment_model: hybrid
provider_model:
  type: single-provider
  byok: true
  local_models: false
  # Anthropic models only. Supports Bedrock, Vertex, Azure Foundry as alternative API hosts.
  # Third-party proxies (LiteLLM, OpenRouter) can route to other providers unofficially.

license:
  type: proprietary
  name: Anthropic Commercial Terms of Service

pricing:
  model: paid
  summary: No free tier. Pro $20/mo, Max $100-200/mo, Team Premium $100/seat/mo, Enterprise custom, or API BYOK pay-per-token.

company:
  name: Anthropic PBC
  stage: late-stage
  funding: $67.3B total raised, $380B valuation (Series G, Feb 2026)

links:
  website: https://code.claude.com
  docs: https://code.claude.com/docs/en/overview
  pricing: https://claude.com/pricing
  github: https://github.com/anthropics/claude-code
  changelog: https://code.claude.com/docs/en/changelog

relevance:
  tier: core
  rationale: SlayZone orchestrates Claude Code as its primary AI agent. Understanding its capabilities and gaps directly shapes what SlayZone needs to provide.

tags:
  - claude-centric
  - cli-first
  - agent-sdk
  - mcp-ecosystem
  - hooks-system
  - enterprise-friendly

comparison_axes:
  kanban_board:
    verdict: no
    confidence: high
    note: No task management UI, kanban board, or project management features. Purely a coding agent.
    source_ids:
      - docs-overview
    last_checked: 2026-03-27

  real_terminal:
    verdict: partial
    confidence: high
    note: Uses a persistent bash session via its Bash tool. Can run shell commands but lacks true PTY emulation for interactive programs.
    source_ids:
      - docs-overview
      - gh-issue-9881
    last_checked: 2026-03-27

  embedded_browser:
    verdict: partial
    confidence: high
    note: Chrome integration (beta) connects to Chrome/Edge via extension. Can navigate, click, fill forms, read console, monitor network. Also has Computer Use tool. Not a first-class embedded pane.
    source_ids:
      - docs-chrome
    last_checked: 2026-03-27

  code_editor:
    verdict: no
    confidence: high
    note: No built-in code editor. Uses diff-based workflow. In IDE extensions (VS Code, JetBrains), leverages the host IDE's editor and diff viewer.
    source_ids:
      - docs-vscode
      - docs-overview
    last_checked: 2026-03-27

  git_worktree_isolation:
    verdict: yes
    confidence: high
    note: "First-class since v2.1.50. `claude --worktree` creates isolated git worktree with own branch. Subagents can use `isolation: worktree` in frontmatter."
    source_ids:
      - docs-workflows
    last_checked: 2026-03-27

  mcp_client:
    verdict: yes
    confidence: high
    note: Connects to external MCP servers. Configured via `~/.claude.json`, `.mcp.json`, or `claude mcp add`. Supports stdio transport.
    source_ids:
      - docs-mcp
    last_checked: 2026-03-27

  mcp_server:
    verdict: yes
    confidence: high
    note: "`claude mcp serve` exposes Claude Code's tools (Bash, Read, Write, Edit, Glob, Grep) to other MCP clients via stdio."
    source_ids:
      - docs-mcp
    last_checked: 2026-03-27

  multi_provider_agents:
    verdict: no
    confidence: high
    note: Anthropic models only. Supports alternative Anthropic API hosts (Bedrock, Vertex, Azure Foundry) but not non-Anthropic models natively. Third-party proxies are unofficial workarounds.
    source_ids:
      - docs-model-config
    last_checked: 2026-03-27

  local_first:
    verdict: partial
    confidence: high
    note: CLI runs locally, files and session data in ~/.claude/. But API calls go to Anthropic servers. Web mode and cloud sessions run on Anthropic infrastructure. No offline mode.
    source_ids:
      - docs-overview
      - docs-settings
    last_checked: 2026-03-27

  native_desktop:
    verdict: partial
    confidence: high
    note: Electron-based desktop app for macOS and Windows. Visual diff review, multiple sessions, scheduling. Not a native app (Electron wrapper).
    source_ids:
      - docs-desktop
    last_checked: 2026-03-27

  cli_companion:
    verdict: yes
    confidence: high
    note: Claude Code IS a CLI-first tool. Terminal is the primary interface.
    source_ids:
      - docs-overview
    last_checked: 2026-03-27

  issue_sync:
    verdict: partial
    confidence: medium
    note: GitHub integration via claude-code-action (auto-review PRs, triage issues). Slack integration (@Claude bot). No native Linear, Jira, or Asana integration. MCP servers can bridge.
    source_ids:
      - docs-github-actions
      - docs-slack
      - gh-issue-12925
    last_checked: 2026-03-27

  pr_review_workflow:
    verdict: yes
    confidence: high
    note: Multiple mechanisms. claude-code-action GitHub Action auto-reviews PRs with inline comments. Built-in /review-pr skill. Can create PRs and branches via gh CLI. GitLab CI/CD also supported.
    source_ids:
      - docs-github-actions
      - docs-code-review
    last_checked: 2026-03-27

  team_collaboration:
    verdict: partial
    confidence: medium
    note: Agent Teams (experimental, disabled by default). Lead session coordinates teammates with shared task list and inter-agent messaging. Session sharing via export. Shared config via CLAUDE.md in version control.
    source_ids:
      - docs-agent-teams
    last_checked: 2026-03-27

  mobile_remote:
    verdict: yes
    confidence: high
    note: Remote Control (`/rc`) bridges local CLI to claude.ai/code, iOS, and Android apps via QR code. Channels feature pushes events from Telegram, Discord, iMessage, webhooks. Dispatch sends tasks from phone to desktop.
    source_ids:
      - docs-remote-control
      - docs-channels
    last_checked: 2026-03-27

  oss_posture:
    verdict: no
    confidence: high
    note: Proprietary. Source-viewable on GitHub but not open source. Licensed under Anthropic Commercial Terms. Community has requested open-sourcing; Anthropic has not complied. claude-code-action is MIT-licensed separately.
    source_ids:
      - gh-license
      - gh-issue-22002
    last_checked: 2026-03-27

assets:
  - path: assets/terminal-demo.png
    caption: Claude Code terminal UI showing agentic coding session with test coverage analysis.
    proves: Confirms CLI-first interface shape, terminal-based interaction model, and agentic workflow.
    source_url: https://github.com/anthropics/claude-code
    captured_on: 2026-03-27

sources:
  - id: docs-overview
    label: Claude Code overview
    kind: official
    url: https://code.claude.com/docs/en/overview

  - id: docs-vscode
    label: VS Code extension docs
    kind: official
    url: https://code.claude.com/docs/en/vs-code

  - id: docs-desktop
    label: Desktop app docs
    kind: official
    url: https://code.claude.com/docs/en/desktop

  - id: docs-mcp
    label: MCP docs
    kind: official
    url: https://code.claude.com/docs/en/mcp

  - id: docs-chrome
    label: Chrome integration docs
    kind: official
    url: https://code.claude.com/docs/en/chrome

  - id: docs-model-config
    label: Model configuration docs
    kind: official
    url: https://code.claude.com/docs/en/model-config

  - id: docs-workflows
    label: Common workflows (worktrees, etc.)
    kind: official
    url: https://code.claude.com/docs/en/common-workflows

  - id: docs-settings
    label: Settings docs
    kind: official
    url: https://code.claude.com/docs/en/settings

  - id: docs-github-actions
    label: GitHub Actions integration
    kind: official
    url: https://code.claude.com/docs/en/github-actions

  - id: docs-code-review
    label: Code review docs
    kind: official
    url: https://code.claude.com/docs/en/code-review

  - id: docs-agent-teams
    label: Agent Teams (experimental)
    kind: official
    url: https://code.claude.com/docs/en/agent-teams

  - id: docs-remote-control
    label: Remote Control docs
    kind: official
    url: https://code.claude.com/docs/en/remote-control

  - id: docs-channels
    label: Channels docs
    kind: official
    url: https://code.claude.com/docs/en/channels

  - id: docs-slack
    label: Slack integration
    kind: official
    url: https://code.claude.com/docs/en/slack

  - id: docs-hooks
    label: Hooks guide
    kind: official
    url: https://code.claude.com/docs/en/hooks-guide

  - id: docs-agent-sdk
    label: Claude Agent SDK overview
    kind: official
    url: https://platform.claude.com/docs/en/agent-sdk/overview

  - id: docs-headless
    label: Headless mode docs
    kind: official
    url: https://code.claude.com/docs/en/headless

  - id: pricing-page
    label: Claude pricing page
    kind: official
    url: https://claude.com/pricing

  - id: gh-repo
    label: GitHub repository
    kind: official
    url: https://github.com/anthropics/claude-code

  - id: gh-license
    label: License file
    kind: official
    url: https://github.com/anthropics/claude-code/blob/main/LICENSE.md

  - id: gh-issue-9881
    label: PTY support feature request
    kind: community
    url: https://github.com/anthropics/claude-code/issues/9881

  - id: gh-issue-12925
    label: Linear integration feature request
    kind: community
    url: https://github.com/anthropics/claude-code/issues/12925

  - id: gh-issue-22002
    label: Open source license request
    kind: community
    url: https://github.com/anthropics/claude-code/issues/22002

  - id: funding-announcement
    label: Anthropic Series G announcement
    kind: official
    url: https://www.anthropic.com/news/anthropic-raises-30-billion-series-g-funding-380-billion-post-money-valuation
---

# Claude Code

## Summary

Anthropic's agentic coding tool. CLI-first, with extensions into VS Code, JetBrains, a desktop app, web interface, and mobile remote control. Reads codebases, edits files, runs commands, manages git workflows, and integrates with external tools via MCP. Anthropic models only. 83K+ GitHub stars. No task management UI.

## Positioning

Claude Code positions itself as the authoritative agent for developers who want AI-assisted coding without leaving their terminal. It is not trying to be an IDE or a project management tool. Instead it is infrastructure: the agent runtime that other tools (including SlayZone) build on top of.

The Agent SDK extends this positioning from "tool for developers" to "platform for agent builders," making Claude Code's agent loop embeddable in custom applications.

## Best-Fit User or Team

Solo developers and small teams who:
- already live in the terminal
- use Claude as their primary model
- want deep git integration (worktrees, PRs, branching)
- are comfortable with BYOK API pricing for heavy usage
- want to build custom agent workflows via SDK/hooks

Less suited for teams that need visual task management, multi-provider model access, or a GUI-first workflow.

## Structured Feature Analysis

### Kanban / Task Board

No task management of any kind. Claude Code is a coding agent, not a project management tool. This is the single largest gap from SlayZone's perspective.

### Real Terminal / PTY

Partial. Claude Code runs shell commands via a persistent bash session, but it does not have true PTY emulation. Interactive programs (vim, htop, ssh interactive sessions) are not supported. A feature request (Issue #9881) exists but is unimplemented. SlayZone's node-pty integration provides what Claude Code cannot.

### Embedded Browser

Partial. Chrome integration (beta) connects to local Chrome/Edge via an extension. Can navigate, click, fill forms, read console logs, monitor network requests. Also has Computer Use tool for full screen control. However, this is not an embedded browser pane — it requires an external Chrome instance.

### Code Editor / Review Surface

No standalone editor. Claude Code proposes changes as diffs. In VS Code and JetBrains, it leverages the host IDE's editor. The desktop app and CLI show diffs in their respective UIs. There is no independent editing environment.

### Git Worktree Isolation

Yes, first-class. `claude --worktree` creates an isolated git worktree with its own branch. Subagents can use `isolation: worktree` in their definitions. Worktrees are auto-cleaned when subagents finish without changes. This is a strong feature that SlayZone also leverages directly.

### MCP

Both client and server. As client, connects to external MCP servers configured via JSON files or CLI commands. As server, `claude mcp serve` exposes its tools (Bash, Read, Write, Edit, Glob, Grep) over stdio. This dual posture makes Claude Code both extensible and embeddable in MCP ecosystems.

### Multi-Provider Agents

Anthropic models only. Supports Bedrock, Vertex, and Azure Foundry as alternative Anthropic API hosts, but these still serve Anthropic models. Third-party proxies (LiteLLM, OpenRouter) can route requests to other providers, but this is unofficial and unsupported. SlayZone's support for both Claude Code and Codex addresses this gap.

## Strengths

- Deepest agentic coding experience available in a CLI.
- First-class git worktree isolation for parallel agent work.
- Rich extensibility via MCP (both client and server), hooks, and Agent SDK.
- Massive community and ecosystem (83K+ GitHub stars).
- Fast iteration: extensive changelog with frequent capability additions.
- Multi-surface: CLI, VS Code, JetBrains, desktop, web, mobile.
- Strong GitHub/GitLab CI integration for automated PR review.

## Weaknesses

- No task management, kanban, or project planning UI.
- Anthropic models only — locked to one provider.
- No true PTY for interactive terminal programs.
- Proprietary license despite community pressure to open-source.
- No free tier — minimum $20/mo or API credits required.
- Desktop app is Electron, not native.
- No native integration with issue trackers beyond GitHub.

## Pricing and Packaging

No free tier. Entry point is Pro at $20/mo (includes Sonnet 4.6 and Opus 4.6). Max plans at $100/mo (5x) and $200/mo (20x) for heavier usage. Team Premium at $100/seat/mo (min 5 seats). Enterprise at custom pricing with HIPAA, compliance tooling, and 500K context. API BYOK pay-per-token (Sonnet 4.6: $3/$15 per MTok in/out).

## Community or Market Signal

83,581 GitHub stars, 7,049 forks, 8,158 open issues as of March 2026. Extremely active community. Common complaints: proprietary license, no multi-provider support, token costs for heavy usage. The rapid expansion to desktop, web, and mobile surfaces signals Anthropic's ambition to make Claude Code the default developer agent platform.

## Why It Matters to SlayZone

Claude Code is not just a competitor — it is SlayZone's primary embedded agent. SlayZone orchestrates Claude Code sessions and adds what Claude Code lacks: visual task management (kanban), multi-provider support (Codex alongside Claude), real PTY terminals, and a unified desktop workspace. Every capability Claude Code adds is something SlayZone can leverage; every gap it leaves is something SlayZone must fill. The relationship is symbiotic and competitive simultaneously.

## Sources

Source list lives in frontmatter. Key sources:
- [Claude Code Overview](https://code.claude.com/docs/en/overview) — primary product docs
- [GitHub repo](https://github.com/anthropics/claude-code) — 83K+ stars, proprietary license
- [Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) — embeddable agent runtime
- [Anthropic Series G](https://www.anthropic.com/news/anthropic-raises-30-billion-series-g-funding-380-billion-post-money-valuation) — $380B valuation
