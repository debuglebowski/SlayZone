import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { homedir, userInfo, platform } from 'os'

interface PtySession {
  pty: pty.IPty
  taskId: string
  checkingForSessionError?: boolean
}

const sessions = new Map<string, PtySession>()

// Pattern to detect Claude session not found error
const SESSION_NOT_FOUND_PATTERN = /No conversation found with session ID:/

function getShell(): string {
  if (platform() === 'win32') {
    return process.env.COMSPEC || 'cmd.exe'
  }
  return process.env.SHELL || '/bin/bash'
}

export function createPty(
  win: BrowserWindow,
  taskId: string,
  cwd: string,
  sessionId?: string | null,
  existingSessionId?: string | null
): { success: boolean; error?: string } {
  // Kill existing if any
  if (sessions.has(taskId)) {
    killPty(taskId)
  }

  try {
    // Build claude command args
    const claudeArgs: string[] = []
    if (existingSessionId) {
      claudeArgs.push('--resume', existingSessionId)
    } else if (sessionId) {
      claudeArgs.push('--session-id', sessionId)
    }

    const shell = getShell()
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd || homedir(),
      env: {
        ...process.env,
        USER: process.env.USER || userInfo().username,
        HOME: process.env.HOME || homedir(),
        TERM: 'xterm-256color'
      } as Record<string, string>
    })

    sessions.set(taskId, { 
      pty: ptyProcess, 
      taskId,
      // Only check for session errors if we're trying to resume
      checkingForSessionError: !!existingSessionId
    })

    // Forward data to renderer
    ptyProcess.onData((data) => {
      if (!win.isDestroyed()) {
        win.webContents.send('pty:data', taskId, data)
        
        // Check for session not found error (only in the first few seconds)
        const session = sessions.get(taskId)
        if (session?.checkingForSessionError && SESSION_NOT_FOUND_PATTERN.test(data)) {
          // Stop checking after we find the error
          session.checkingForSessionError = false
          win.webContents.send('pty:session-not-found', taskId)
        }
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      sessions.delete(taskId)
      if (!win.isDestroyed()) {
        win.webContents.send('pty:exit', taskId, exitCode)
      }
    })

    // If we have claude args, start claude after shell is ready
    if (claudeArgs.length > 0) {
      // Small delay to let shell initialize
      setTimeout(() => {
        if (sessions.has(taskId)) {
          ptyProcess.write(`claude ${claudeArgs.join(' ')}\r`)
        }
      }, 100)
    }

    // Stop checking for session errors after 5 seconds
    if (existingSessionId) {
      setTimeout(() => {
        const session = sessions.get(taskId)
        if (session) {
          session.checkingForSessionError = false
        }
      }, 5000)
    }

    return { success: true }
  } catch (error) {
    const err = error as Error
    return { success: false, error: err.message }
  }
}

export function writePty(taskId: string, data: string): boolean {
  const session = sessions.get(taskId)
  if (!session) return false
  session.pty.write(data)
  return true
}

export function resizePty(taskId: string, cols: number, rows: number): boolean {
  const session = sessions.get(taskId)
  if (!session) return false
  session.pty.resize(cols, rows)
  return true
}

export function killPty(taskId: string): boolean {
  const session = sessions.get(taskId)
  if (!session) return false
  session.pty.kill()
  sessions.delete(taskId)
  return true
}

export function hasPty(taskId: string): boolean {
  return sessions.has(taskId)
}

export function killAllPtys(): void {
  for (const [taskId] of sessions) {
    killPty(taskId)
  }
}
