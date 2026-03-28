---
name: OpenAI Codex App
slug: codex-app
status: active
last_checked: 2026-03-28

primary_category: desktop-environment
secondary_categories:
  - agent-orchestrator

platforms:
  - macos
  - windows
  # Linux waitlisted ("get notified" form on site).

workflow_shape: thread-first
deployment_model: hybrid
provider_model:
  type: single-provider
  byok: true
  local_models: false
  # OpenAI models only. Supports API key or ChatGPT subscription auth.

license:
  type: proprietary
  name: Proprietary

pricing:
  model: subscription
  summary: Included with ChatGPT Plus ($20/mo), Pro ($200/mo), Business, Edu, and Enterprise. Additional credits purchasable. API key auth also supported.

company:
  name: OpenAI
  stage: growth
  funding: venture-backed

links:
  website: https://openai.com/codex/
  docs: https://developers.openai.com/codex/app
  pricing: https://developers.openai.com/codex/pricing
  changelog: https://developers.openai.com/codex/changelog

relevance:
  tier: core
  rationale: First-party desktop agent orchestrator from OpenAI. Parallel threads, worktrees, diff review, terminal — direct overlap with SlayZone's core surface.

tags:
  - desktop-first
  - multi-agent
  - codex-native
  - watch-closely

comparison_axes:
  kanban_board:
    verdict: no
    confidence: high
    note: Thread-based task list, not a board. Projects organize threads but no Kanban/status-lane UX.
    source_ids:
      - docs-app
      - docs-features
    last_checked: 2026-03-28

  real_terminal:
    verdict: yes
    confidence: high
    note: Built-in terminal per thread scoped to project/worktree. Cmd+J toggle. Agent can read terminal output. Used for testing, dev servers, git ops.
    source_ids:
      - docs-features
    last_checked: 2026-03-28

  embedded_browser:
    verdict: no
    confidence: medium
    note: Web search tool exists for agent use but no embedded browser pane in the app UI.
    source_ids:
      - docs-features
    last_checked: 2026-03-28

  code_editor:
    verdict: partial
    confidence: high
    note: Diff review pane with inline comments, per-hunk staging/reverting, scope switching (uncommitted/branch/last turn). Opens files in external editor on click. Not a full editor.
    source_ids:
      - docs-review
      - docs-features
    last_checked: 2026-03-28

  git_worktree_isolation:
    verdict: yes
    confidence: high
    note: First-class worktree support. Each thread can get an isolated worktree. Local, Worktree, and Cloud execution modes. Worktree setup scripts supported.
    source_ids:
      - docs-worktrees
      - docs-app
    last_checked: 2026-03-28

  mcp_client:
    verdict: yes
    confidence: high
    note: MCP server configuration shared across App, CLI, and IDE Extension. Connect agent to third-party services.
    source_ids:
      - docs-features
      - docs-mcp
    last_checked: 2026-03-28

  mcp_server:
    verdict: yes
    confidence: high
    note: Codex exposes an MCP server endpoint. Documented under Automation section.
    source_ids:
      - docs-mcp-server
    last_checked: 2026-03-28

  multi_provider_agents:
    verdict: no
    confidence: high
    note: OpenAI models only (GPT-5.3-Codex, o3, o4-mini, etc.). No support for Anthropic, Google, or other providers.
    source_ids:
      - docs-app
    last_checked: 2026-03-28

  local_first:
    verdict: partial
    confidence: medium
    note: Local execution mode works on local filesystem. But requires ChatGPT auth or API key. Cloud threads mode sends code to OpenAI servers. Hybrid model.
    source_ids:
      - docs-app
      - docs-features
    last_checked: 2026-03-28

  native_desktop:
    verdict: yes
    confidence: high
    note: Native desktop app for macOS and Windows. Linux waitlisted.
    source_ids:
      - docs-app
    last_checked: 2026-03-28

  cli_companion:
    verdict: yes
    confidence: high
    note: Codex CLI (open-source, Apache-2.0) is a separate companion product. Shares config, skills, MCP, and thread history.
    source_ids:
      - docs-app
      - docs-features
    last_checked: 2026-03-28

  issue_sync:
    verdict: unknown
    confidence: low
    note: GitHub Action exists for CI integration. No documented issue tracker sync (Linear, Jira, etc.).
    source_ids:
      - docs-app
    last_checked: 2026-03-28

  pr_review_workflow:
    verdict: yes
    confidence: high
    note: Built-in diff review with inline comments, per-hunk staging, commit, push, and PR creation without leaving the app.
    source_ids:
      - docs-review
    last_checked: 2026-03-28

  team_collaboration:
    verdict: partial
    confidence: medium
    note: Enterprise and Business plans exist. Skills can be shared across teams. No real-time collaborative editing or shared workspace documented.
    source_ids:
      - docs-app
    last_checked: 2026-03-28

  mobile_remote:
    verdict: no
    confidence: medium
    note: No mobile app documented. Cloud threads accessible via web at chatgpt.com/codex.
    source_ids:
      - docs-app
    last_checked: 2026-03-28

  oss_posture:
    verdict: partial
    confidence: high
    note: App is proprietary. CLI is open-source (Apache-2.0). Config, skills, and hooks are shared open formats.
    source_ids:
      - docs-app
    last_checked: 2026-03-28

assets:
  - path: assets/product-screenshot.png
    caption: Codex app UI from developer docs. Shows project sidebar, active thread with agent conversation, and diff review pane.
    proves: Confirms thread-based workspace layout, integrated diff review, and desktop app form factor.
    source_url: https://developers.openai.com/codex/app
    captured_on: 2026-03-28

sources:
  - id: docs-app
    label: Codex app overview
    kind: official
    url: https://developers.openai.com/codex/app

  - id: docs-features
    label: Codex app features
    kind: official
    url: https://developers.openai.com/codex/app/features

  - id: docs-review
    label: Codex app review/diff pane
    kind: official
    url: https://developers.openai.com/codex/app/review

  - id: docs-worktrees
    label: Codex app worktrees
    kind: official
    url: https://developers.openai.com/codex/app/worktrees

  - id: docs-mcp
    label: Codex MCP client configuration
    kind: official
    url: https://developers.openai.com/codex/mcp

  - id: docs-mcp-server
    label: Codex MCP server
    kind: official
    url: https://developers.openai.com/codex/guides/agents-sdk

  - id: docs-pricing
    label: Codex pricing
    kind: official
    url: https://developers.openai.com/codex/pricing

  - id: docs-changelog
    label: Codex changelog
    kind: official
    url: https://developers.openai.com/codex/changelog

  - id: cnbc-super-app
    label: CNBC report on OpenAI desktop super app plans
    kind: press
    url: https://www.cnbc.com/2026/03/19/openai-desktop-super-app-chatgpt-browser-codex.html

  - id: zackproser-review
    label: OpenAI Codex Review 2026
    kind: analysis
    url: https://zackproser.com/blog/openai-codex-review-2026
---

# OpenAI Codex App

## Summary

The Codex App is OpenAI's native desktop agent orchestrator — a dedicated Mac/Windows app for running parallel Codex threads with built-in worktree isolation, diff review, terminal, and MCP support. Distinct from the open-source Codex CLI, the app adds a GUI layer for managing multiple agent sessions, reviewing diffs with inline comments, and committing/pushing without leaving the app. Included with ChatGPT Plus ($20/mo) and above. As of March 2026, OpenAI plans to merge the Codex App, ChatGPT desktop app, and a browser into a single "super app."

## Positioning

OpenAI positions the Codex App as "your Codex command center" — a focused desktop environment for parallel agent work. The core value proposition is thread-based multitasking: spin up multiple Codex agents across projects, each in its own worktree, review their output, and merge. It bridges the gap between the CLI (developer-first, terminal-only) and the web (chatgpt.com/codex, cloud-only). The upcoming super app merger signals OpenAI's intent to make this the primary developer interface, not just a companion tool.

## Best-Fit User or Team

Developers already in the OpenAI ecosystem (ChatGPT subscribers, API key users) who want a GUI for managing parallel Codex sessions. Best for users who prefer visual diff review over terminal-only workflows. Less suited for users who need multi-provider agent support, a task/project management layer, or strict local-only operation.

## Structured Feature Analysis

### Kanban / Task Board

No board UI. Threads are organized by project in a sidebar list. No status lanes, drag-and-drop, or card-based workflow. The mental model is "threads in a project," not "tasks on a board." Verdict: no.

### Real Terminal / PTY

Each thread has a built-in terminal scoped to the project or worktree, toggled with Cmd+J. The agent can read terminal output (e.g., check dev server status, failed builds). Used for testing changes, running scripts, and git operations. Verdict: yes.

### Embedded Browser

No embedded browser pane. The agent has a web search tool (first-party, with live or cached results) but this is agent-internal, not a visible browser surface. Verdict: no.

### Code Editor / Review Surface

The review pane is the primary code surface. It shows git diffs with scope switching (uncommitted, all branch changes, last turn). Supports inline comments on specific lines, per-hunk and per-file staging/reverting, and commit/push from within the app. Clicking file names or lines opens them in an external editor. Not a full code editor — it's review-centric, similar to Conductor's approach. Verdict: partial.

### Git Worktree Isolation

First-class feature. Three execution modes: Local (direct), Worktree (isolated git worktree per thread), and Cloud (remote sandbox). Worktree setup scripts allow configuring environment per worktree. Multiple threads can work on the same repo without conflicts. Directly competitive with SlayZone and Conductor. Verdict: yes.

### MCP

MCP client support is built in — connect agent to third-party services via MCP server configuration, shared across App, CLI, and IDE Extension. Codex also exposes its own MCP server endpoint (documented under Automation). This is a differentiator vs Conductor which only consumes MCP. Verdict: client yes, server yes.

### Multi-Provider Agents

OpenAI models only. GPT-5.3-Codex is the primary model, with o3, o4-mini variants. No support for Anthropic Claude, Google Gemini, or other providers. Single-provider lock-in. Verdict: no.

## Strengths

- Backed by OpenAI with massive resources and fast iteration.
- Thread-per-worktree isolation is well-designed and first-class.
- Diff review with inline comments and per-hunk staging is strong.
- MCP client and server support — can both consume and expose tools.
- Companion CLI is open-source, sharing config and skills.
- Included with existing ChatGPT subscriptions — no separate cost.
- Windows support already shipped. Linux waitlisted.
- Super app merger may create an all-in-one developer environment.

## Weaknesses

- OpenAI models only. No multi-provider agent support.
- Thread-based, not task-based — no board, status lanes, or PM layer.
- No embedded browser.
- Requires ChatGPT subscription or API key — not standalone free.
- Cloud thread mode sends code to OpenAI servers — privacy concern for some users.
- Proprietary app (CLI is open-source, app is not).
- No Linux support yet.
- Super app merger creates uncertainty about the app's future as a standalone product.

## Pricing and Packaging

Included with ChatGPT Plus ($20/mo), Pro ($200/mo), Business ($30/user/mo), Edu, and Enterprise. Usage-limited by plan tier (Plus: 30-150 messages/5hr, Pro: 300-1500 messages/5hr). Additional credits purchasable when limits are exceeded. API key auth also works but some features (cloud threads) may be limited.

## Community or Market Signal

Strong adoption driven by OpenAI's distribution. The Codex ecosystem (app + CLI + IDE extension + web) is the most complete first-party agent platform from any model provider. The super app merger (CNBC, March 2026) signals strategic escalation — OpenAI intends the desktop to be the primary developer interface, not just a chat window. Competition with Conductor is direct on the worktree/parallel-agent axis, but the single-provider constraint limits appeal for multi-model users.

## Why It Matters to SlayZone

The Codex App is the biggest platform threat. OpenAI has distribution, brand, and bundled pricing that no startup can match. The worktree + terminal + diff review surface is directly competitive. SlayZone's differentiation: multi-provider agents (not locked to OpenAI), task-centric board (not thread lists), embedded browser, local-first with no cloud dependency, and open-source posture. The super app merger could either strengthen the threat (all-in-one) or dilute it (feature bloat, loss of focus).

## Sources

Source list lives in frontmatter. Key sources:
- Developer docs (developers.openai.com/codex/app) for features, review, worktrees, MCP.
- Pricing docs for plan tiers and usage limits.
- CNBC report for super app merger plans.
