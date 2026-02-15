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

export interface GlobalProviderPaths {
  label: string
  baseDir: string        // relative to $HOME
  instructions?: string  // relative to baseDir
  skillsDir?: string     // relative to baseDir
  commandsDir?: string   // relative to baseDir
}

export const GLOBAL_PROVIDER_PATHS: Record<string, GlobalProviderPaths> = {
  claude:   { label: 'Claude Code', baseDir: '.claude', instructions: 'CLAUDE.md' },
  codex:    { label: 'Codex',       baseDir: '.codex',  instructions: 'AGENTS.md' },
  gemini:   { label: 'Gemini CLI',  baseDir: '.gemini', instructions: 'GEMINI.md', skillsDir: 'skills', commandsDir: 'commands' },
  opencode: { label: 'OpenCode',    baseDir: '.config/opencode', instructions: 'AGENTS.md', skillsDir: 'skills', commandsDir: 'commands' },
}

export const PROVIDER_LABELS: Record<CliProvider, string> = {
  claude: 'Claude Code',
  codex: 'Codex CLI',
  cursor: 'Cursor Agent',
  gemini: 'Gemini CLI',
  opencode: 'OpenCode',
}
