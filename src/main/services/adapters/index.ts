export type { TerminalMode, TerminalAdapter, SpawnConfig, PromptInfo, StructuredEvent } from './types'

import type { TerminalMode, TerminalAdapter } from './types'
import { ClaudeAdapter } from './claude-adapter'
import { CodexAdapter } from './codex-adapter'
import { ShellAdapter } from './shell-adapter'

const adapters: Record<TerminalMode, TerminalAdapter> = {
  'claude-code': new ClaudeAdapter(),
  'codex': new CodexAdapter(),
  'terminal': new ShellAdapter()
}

/**
 * Get the adapter for a terminal mode.
 */
export function getAdapter(mode: TerminalMode): TerminalAdapter {
  return adapters[mode]
}

/**
 * Get the default adapter (claude-code).
 */
export function getDefaultAdapter(): TerminalAdapter {
  return adapters['claude-code']
}
