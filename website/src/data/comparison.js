export const competitors = [
  'SlayZone',
  'VibeKanban',
  'Superset.sh',
  'Conductor',
  'Maestro',
  'AutoMaker',
  'AutoClaude',
  'Cursor',
  'Devin',
  'Lovable',
  'Linear',
  'Zeroshot',
]

export const comparisonRows = [
  {
    feature: 'Kanban board',
    tooltip: 'Visual board with columns for task status. Drag cards between stages.',
    values: ['yes', 'yes', 'no', 'no', 'no', 'yes', 'yes', 'no', 'no', 'no', 'yes', 'no'],
  },
  {
    feature: 'Local-first',
    tooltip: 'All data stored on your machine. Works offline, no account required.',
    values: ['yes', 'partial', 'partial', 'no', 'yes', 'partial', 'no', 'yes', 'no', 'no', 'no', 'yes'],
  },
  {
    feature: 'MCP server',
    tooltip: 'Exposes an MCP server so AI agents can read task context and update statuses.',
    values: ['yes', 'yes', 'yes', 'no', 'partial', 'yes', 'no', 'no', 'yes', 'no', 'yes', 'no'],
  },
  {
    feature: 'Keyboard-driven',
    tooltip: 'Navigate, create tasks, switch tabs, and manage agents entirely from the keyboard.',
    values: ['yes', 'partial', 'yes', 'partial', 'partial', 'partial', 'no', 'yes', 'no', 'no', 'yes', 'partial'],
    noBorder: true,
  },
  { spacer: true },
  {
    feature: 'All of the below — per task',
    tooltip: 'Each task card contains its own terminal, browser, editor, and git worktree — fully isolated.',
    values: ['yes', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no'],
    punchline: true,
  },
  {
    feature: 'Terminal',
    tooltip: 'Real PTY terminal (not a sandbox). Run any CLI tool, shell, or agent directly.',
    values: ['yes', 'partial', 'yes', 'partial', 'yes', 'yes', 'yes', 'partial', 'yes', 'no', 'no', 'no'],
  },
  {
    feature: 'Embedded browser',
    tooltip: 'Built-in Chromium browser per task for docs, PRs, and live previews.',
    values: ['yes', 'partial', 'yes', 'no', 'no', 'no', 'no', 'partial', 'yes', 'partial', 'no', 'no'],
  },
  {
    feature: 'Code editor',
    tooltip: 'Integrated code editor with syntax highlighting for reviewing agent changes.',
    values: ['yes', 'partial', 'yes', 'partial', 'partial', 'yes', 'no', 'yes', 'yes', 'partial', 'no', 'no'],
  },
  {
    feature: 'Git worktree isolation',
    tooltip: 'Each task gets its own git worktree — isolated branches, no conflicts between parallel tasks.',
    values: ['yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'no', 'yes', 'partial', 'no', 'no', 'yes'],
  },
  {
    feature: 'Multi-provider AI agents',
    tooltip: 'Run Claude Code, Codex, Gemini CLI, and more — pick the best agent per task.',
    values: ['yes', 'yes', 'yes', 'partial', 'yes', 'partial', 'no', 'yes', 'no', 'no', 'no', 'yes'],
  },
]
