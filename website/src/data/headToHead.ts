import type { CompetitorCanon, Verdict, Confidence } from './competitorCanon'

export type HeadToHeadAxisKey =
  | 'kanban_board'
  | 'local_first'
  | 'real_terminal'
  | 'embedded_browser'
  | 'code_editor'
  | 'git_worktree_isolation'
  | 'mcp_server'
  | 'multi_provider_agents'
  | 'issue_sync'
  | 'pr_review_workflow'
  | 'native_desktop'
  | 'cli_companion'

export interface HeadToHeadRow {
  key: HeadToHeadAxisKey
  label: string
  why: string
  slayzone: {
    verdict: Verdict
    note: string
  }
  competitor: {
    verdict: Verdict
    note: string
    confidence: Confidence
  }
}

interface SlayZoneAxis {
  label: string
  why: string
  verdict: Verdict
  note: string
}

const axisConfig: Record<HeadToHeadAxisKey, SlayZoneAxis> = {
  kanban_board: {
    label: 'Kanban board',
    why: 'This is product-shape, not garnish. Task-first orchestration is SlayZone moat.',
    verdict: 'yes',
    note: 'Board is primary control surface. Tasks, statuses, subtasks, dependencies, tags, and search live in one place.',
  },
  local_first: {
    label: 'Local-first',
    why: 'No-login local workflows reduce friction and trust cost for serious dev work.',
    verdict: 'yes',
    note: 'Public site positions SlayZone as local-first. Task execution, agent sessions, and browser control stay on your machine.',
  },
  real_terminal: {
    label: 'Real terminal',
    why: 'Fake consoles lose credibility fast. Real PTY is table stakes for agent orchestration.',
    verdict: 'yes',
    note: 'Each task owns real PTY sessions with your shell, tooling, and agent CLIs.',
  },
  embedded_browser: {
    label: 'Embedded browser',
    why: 'Docs, localhost, and verification need to stay attached to active work.',
    verdict: 'yes',
    note: 'Every task can keep its own browser pane open beside terminal and diff surfaces.',
  },
  code_editor: {
    label: 'Code editor',
    why: 'Review speed matters when many agents are generating diffs in parallel.',
    verdict: 'yes',
    note: 'Public comparison and feature pages position SlayZone with integrated editor and diff review surfaces.',
  },
  git_worktree_isolation: {
    label: 'Git worktree isolation',
    why: 'Parallel work only scales if isolation is structural, not discipline-based.',
    verdict: 'yes',
    note: 'Each task can own its own worktree, branch, and workspace context.',
  },
  mcp_server: {
    label: 'MCP server',
    why: 'MCP is how external agents and tools act on task context instead of staying blind.',
    verdict: 'yes',
    note: 'SlayZone exposes an MCP server and `slay` CLI so agents can read and update task state.',
  },
  multi_provider_agents: {
    label: 'Multi-provider agents',
    why: 'Real teams mix Claude Code, Codex, Gemini, and local agents by task.',
    verdict: 'yes',
    note: 'Public site explicitly positions SlayZone around Claude Code, Codex, Gemini, OpenCode, Cursor, and local-first CLIs.',
  },
  issue_sync: {
    label: 'Issue sync',
    why: 'Most teams still plan in external PM tools. Sync matters more than replacement.',
    verdict: 'yes',
    note: 'Feature copy promises two-way sync with Linear, GitHub Issues, and Jira.',
  },
  pr_review_workflow: {
    label: 'PR workflow',
    why: 'Shipping loop should stay close to task, diff, and terminal context.',
    verdict: 'yes',
    note: 'Feature copy positions PR creation, review, comments, merge, and cleanup inside task flow.',
  },
  native_desktop: {
    label: 'Native desktop',
    why: 'Persistent orchestration hub works better as installed desktop software than browser tab.',
    verdict: 'yes',
    note: 'Docs page positions SlayZone as desktop app for macOS, Windows, and Linux.',
  },
  cli_companion: {
    label: 'CLI companion',
    why: 'CLI hooks let the product fit existing shell-heavy workflows instead of replacing them.',
    verdict: 'yes',
    note: 'The `slay` CLI mirrors key task and browser workflows from any shell.',
  },
}

export const supersetScorecardKeys: HeadToHeadAxisKey[] = [
  'kanban_board',
  'local_first',
  'real_terminal',
  'embedded_browser',
  'git_worktree_isolation',
  'mcp_server',
]

const axisOrder: HeadToHeadAxisKey[] = [
  'kanban_board',
  'local_first',
  'real_terminal',
  'embedded_browser',
  'code_editor',
  'git_worktree_isolation',
  'mcp_server',
  'multi_provider_agents',
  'issue_sync',
  'pr_review_workflow',
  'native_desktop',
  'cli_companion',
]

export interface HeadToHeadPage {
  slug: string
  title: string
  summary: string
}

export const supersetEditorial = {
  eyebrow: 'Head-to-head / core competitor',
  title: 'SlayZone vs Superset.sh',
  summary:
    'Same desktop-agent DNA. Different product thesis. SlayZone optimizes for task-first orchestration; Superset optimizes for workspace-first agent execution.',
  verdict:
    'Pick SlayZone if you want parallel agent work to stay legible on a board. Pick Superset if you already think in worktrees, terminals, and branch-first desktop shells.',
  pickSlayzone: [
    'Your work lives on a kanban board — tasks, statuses, subtasks, drag-and-drop.',
    'You need the app to run fully offline with no account or cloud sync.',
    'You sync issues with Linear, GitHub Issues, or Jira and want them tied to task cards.',
    'You want Windows and Linux support, not just macOS.',
  ],
  pickCompetitor: [
    'You want terminal sessions to survive app crashes via a persistent daemon process.',
    'Your team is already on Clerk auth and cloud-synced tasks via ElectricSQL.',
    'You rely on the 26-tool MCP surface for browser automation and task tooling.',
    'You want per-workspace port allocation and configurable setup/teardown scripts.',
  ],
  slayzone: {
    what: 'Desktop kanban for AI coding agents. Every card hides a terminal, browser, git worktree, and code editor. Task-first orchestration — the board is the control surface, and each task owns its own isolated workspace.',
    strengths: [
      'Kanban board is primary UX — task visibility, status flow, drag-and-drop, subtasks, dependencies.',
      'Fully local-first: no login, no cloud sync, no mandatory account. SQLite on your machine.',
      'Per-task isolation: each card owns its own terminal sessions, browser pane, worktree, and editor.',
      'CLI companion (`slay`) mirrors task and browser workflows from any shell.',
      'Issue sync with Linear, GitHub Issues, and Jira for teams that plan externally.',
    ],
    weaknesses: [
      'No daemon-based terminal persistence — Superset\'s crash-recovery session model is stronger here.',
      'Fewer MCP tools (growing) vs Superset\'s 26-tool surface.',
      'No enterprise positioning or team/org features yet.',
      'Younger community — smaller star count and less third-party coverage.',
    ],
  },
  superset: {
    what: 'Desktop terminal multiplexer for orchestrating parallel CLI coding agents across isolated git worktrees. Workspace-first — the organizational primitive is the worktree, not the task card. Ships with real PTY, CodeMirror diff viewer, embedded browser, and cloud-synced task table.',
    strengths: [
      'Daemon-based terminal session persistence across crashes — genuinely better than most competitors.',
      'Near-daily release cadence (~100+ releases in 5 months) shows strong execution velocity.',
      'Two MCP servers (26 tools) provide rich external integration surface.',
      'Automatic worktree creation with configurable setup/teardown scripts and port allocation.',
      'Enterprise logos (Microsoft, OpenAI, Netflix, Google) suggest real adoption traction.',
    ],
    weaknesses: [
      'Mandatory login for local worktree access — "local-first" marketing is misleading given cloud auth dependency.',
      'No kanban board or visual project management — workspace sidebar is not a PM tool.',
      'ELv2 license (source-available, not OSS) — was previously misrepresented as Apache 2.0.',
      'macOS-primary. Linux via AppImage (Feb 2026), Windows not yet shipped.',
      'Mastra chat routes through Fly.io — privacy gap for users expecting local-only operation.',
    ],
  },
}

export const headToHeadPages: HeadToHeadPage[] = [
  {
    slug: 'superset',
    title: supersetEditorial.title,
    summary: supersetEditorial.summary,
  },
]

export function buildHeadToHeadRows(
  competitor: CompetitorCanon,
  keys: HeadToHeadAxisKey[] = axisOrder,
): HeadToHeadRow[] {
  return keys.map((key) => {
    const competitorAxis = competitor.comparison_axes[key]
    if (!competitorAxis) {
      throw new Error(`Missing comparison axis "${key}" for ${competitor.slug}`)
    }

    const slayzoneAxis = axisConfig[key]

    return {
      key,
      label: slayzoneAxis.label,
      why: slayzoneAxis.why,
      slayzone: {
        verdict: slayzoneAxis.verdict,
        note: slayzoneAxis.note,
      },
      competitor: {
        verdict: competitorAxis.verdict,
        note: competitorAxis.note,
        confidence: competitorAxis.confidence,
      },
    }
  })
}
