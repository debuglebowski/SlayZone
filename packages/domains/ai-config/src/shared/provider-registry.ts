import type { CliProvider, ProviderPathMapping } from './types'

export const PROVIDER_PATHS: Record<CliProvider, ProviderPathMapping> = {
  claude: {
    rootInstructions: 'CLAUDE.md',
    skillsDir: '.claude/skills',
    commandsDir: '.claude/commands',
  },
  codex: {
    rootInstructions: 'AGENTS.md',
    skillsDir: '.agents/skills',
    commandsDir: null,
  },
  cursor: {
    rootInstructions: '.cursorrules',
    skillsDir: null,
    commandsDir: null,
  },
  gemini: {
    rootInstructions: 'GEMINI.md',
    skillsDir: '.gemini/skills',
    commandsDir: null,
  },
  opencode: {
    rootInstructions: 'OPENCODE.md',
    skillsDir: null,
    commandsDir: null,
  },
}

export const PROVIDER_LABELS: Record<CliProvider, string> = {
  claude: 'Claude Code',
  codex: 'Codex CLI',
  cursor: 'Cursor Agent',
  gemini: 'Gemini CLI',
  opencode: 'OpenCode',
}
