import { platform, homedir } from 'os'
import type { TerminalState } from '../../../shared/types/api'
import type { TerminalAdapter, SpawnConfig, PromptInfo, StructuredEvent } from './types'

/**
 * Adapter for Claude Code CLI.
 * Handles JSON structured output parsing and conversation resume.
 */
export class ClaudeAdapter implements TerminalAdapter {
  readonly mode = 'claude-code' as const

  buildSpawnConfig(_cwd: string, conversationId?: string, resuming?: boolean, _shellOverride?: string): SpawnConfig {
    const claudeArgs: string[] = []

    // Only pass --resume for existing sessions, not --session-id for new ones
    // Claude generates its own session IDs
    if (resuming && conversationId) {
      claudeArgs.push('--resume', conversationId)
    }

    // Spawn claude directly
    const claudePath = platform() === 'win32' ? 'claude' : `${homedir()}/.local/bin/claude`

    return {
      shell: claudePath,
      args: claudeArgs
    }
  }

  detectPrompt(data: string): PromptInfo | null {
    // Look for JSON events indicating permission/input needed
    const lines = data.split('\n')
    for (const line of lines) {
      if (!line.trim().startsWith('{')) continue

      try {
        const event = JSON.parse(line)
        // Claude Code emits specific event types for prompts
        if (event.type === 'assistant' && event.message?.content) {
          const content = event.message.content
          // Check if this looks like a question
          if (typeof content === 'string' && content.includes('?')) {
            return {
              type: 'question',
              text: content,
              position: data.indexOf(line)
            }
          }
        }
        // Permission prompts have specific structure
        if (event.type === 'tool_use' || event.type === 'permission_request') {
          return {
            type: 'permission',
            text: event.tool_name || 'Permission required',
            position: data.indexOf(line)
          }
        }
      } catch {
        // Not valid JSON, skip
      }
    }
    return null
  }

  parseEvent(data: string): StructuredEvent | null {
    const lines = data.split('\n')
    for (const line of lines) {
      if (!line.trim().startsWith('{')) continue

      try {
        const event = JSON.parse(line)
        if (event.type) {
          return {
            type: event.type,
            data: event
          }
        }
      } catch {
        // Not valid JSON
      }
    }
    return null
  }

  detectState(data: string, _currentState: TerminalState): TerminalState | null {
    // Parse JSON events to detect state
    const event = this.parseEvent(data)
    if (event) {
      console.log(`[ClaudeAdapter] Event type: "${event.type}"`, JSON.stringify(event.data).slice(0, 200))
    }
    if (!event) return null

    // Map event types to states
    switch (event.type) {
      case 'thinking':
      case 'tool_use':
      case 'assistant':
        return 'running'
      case 'input_request':
      case 'permission_request':
        return 'awaiting_input'
      case 'error':
        return 'error'
      case 'result':
      case 'done':
        return 'idle'
      default:
        console.log(`[ClaudeAdapter] Unknown event type: "${event.type}"`)
        return null
    }
  }
}
