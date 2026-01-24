import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { createPty, killPty, hasPty, getState, writePty, resizePty, getBuffer } from './pty-manager'
import type { TerminalMode } from './adapters'
import type { TerminalState } from '../../shared/types/api'
import { getDatabase } from '../db'

interface TaskTerminalConfig {
  mode: TerminalMode
  conversationId: string | null
  resuming: boolean
  cwd: string
}

/**
 * Orchestrates the relationship between tasks and their terminal sessions.
 * Reads task config from DB, manages conversation IDs, and routes commands.
 */
export class TaskTerminalManager {
  private win: BrowserWindow | null = null

  setWindow(win: BrowserWindow): void {
    this.win = win
  }

  /**
   * Start a terminal for a task, reading config from DB.
   */
  async startTerminal(taskId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.win) {
      return { success: false, error: 'No window available' }
    }

    const config = this.getTaskConfig(taskId)
    if (!config) {
      return { success: false, error: 'Task not found' }
    }

    // Generate conversation ID if needed for agent modes
    let conversationId = config.conversationId
    if (!conversationId && (config.mode === 'claude-code' || config.mode === 'codex')) {
      conversationId = randomUUID()
      this.saveConversationId(taskId, config.mode, conversationId)
    }

    return createPty(
      this.win,
      taskId,
      config.cwd,
      config.resuming ? undefined : conversationId ?? undefined,
      config.resuming ? conversationId ?? undefined : undefined,
      config.mode
    )
  }

  /**
   * Stop a terminal for a task.
   */
  stopTerminal(taskId: string): boolean {
    return killPty(taskId)
  }

  /**
   * Check if a terminal is running for a task.
   */
  hasTerminal(taskId: string): boolean {
    return hasPty(taskId)
  }

  /**
   * Get terminal state for a task.
   */
  getTerminalState(taskId: string): TerminalState | null {
    return getState(taskId)
  }

  /**
   * Write to terminal.
   */
  write(taskId: string, data: string): boolean {
    return writePty(taskId, data)
  }

  /**
   * Resize terminal.
   */
  resize(taskId: string, cols: number, rows: number): boolean {
    return resizePty(taskId, cols, rows)
  }

  /**
   * Get terminal buffer.
   */
  getBuffer(taskId: string): string | null {
    return getBuffer(taskId)
  }

  /**
   * Read task terminal config from database.
   */
  private getTaskConfig(taskId: string): TaskTerminalConfig | null {
    const db = getDatabase()
    const task = db
      .prepare(
        `SELECT
          terminal_mode,
          claude_conversation_id,
          codex_conversation_id,
          terminal_shell,
          p.path as project_path
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = ?`
      )
      .get(taskId) as
      | {
          terminal_mode: string | null
          claude_conversation_id: string | null
          codex_conversation_id: string | null
          terminal_shell: string | null
          project_path: string | null
        }
      | undefined

    if (!task) return null

    const mode = (task.terminal_mode || 'claude-code') as TerminalMode
    let conversationId: string | null = null
    let resuming = false

    if (mode === 'claude-code' && task.claude_conversation_id) {
      conversationId = task.claude_conversation_id
      resuming = true
    } else if (mode === 'codex' && task.codex_conversation_id) {
      conversationId = task.codex_conversation_id
      resuming = true
    }

    return {
      mode,
      conversationId,
      resuming,
      cwd: task.project_path || process.cwd()
    }
  }

  /**
   * Save conversation ID to database for resume.
   */
  private saveConversationId(taskId: string, mode: TerminalMode, conversationId: string): void {
    const db = getDatabase()
    const column = mode === 'claude-code' ? 'claude_conversation_id' : 'codex_conversation_id'
    db.prepare(`UPDATE tasks SET ${column} = ?, updated_at = datetime('now') WHERE id = ?`).run(
      conversationId,
      taskId
    )
  }
}

// Singleton instance
export const taskTerminalManager = new TaskTerminalManager()
