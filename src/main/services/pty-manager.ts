import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { homedir, userInfo, platform } from 'os'

interface PtySession {
  pty: pty.IPty
  taskId: string
  checkingForSessionError?: boolean
  buffer: string
  lastOutputTime: number
  isIdle: boolean
}

export interface PtyInfo {
  taskId: string
  lastOutputTime: number
  isIdle: boolean
}

const sessions = new Map<string, PtySession>()

// Maximum buffer size (~1MB) to prevent memory issues
const MAX_BUFFER_SIZE = 1024 * 1024

// Idle timeout in milliseconds (60 seconds)
const IDLE_TIMEOUT_MS = 60 * 1000

// Check interval for idle sessions (10 seconds)
const IDLE_CHECK_INTERVAL_MS = 10 * 1000

// Reference to main window for sending idle events
let mainWindow: BrowserWindow | null = null

// Interval reference for idle checker
let idleCheckerInterval: NodeJS.Timeout | null = null

// Pattern to detect Claude session not found error
const SESSION_NOT_FOUND_PATTERN = /No conversation found with session ID:/

// Filter out terminal escape sequences that shouldn't be replayed
function filterBufferData(data: string): string {
  return data
    // Filter OSC sequences (ESC ] ... BEL or ESC ] ... ST)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // Filter DA responses (ESC [ ? ... c)
    .replace(/\x1b\[\?[0-9;]*c/g, '')
}

function getShell(): string {
  if (platform() === 'win32') {
    return process.env.COMSPEC || 'cmd.exe'
  }
  return process.env.SHELL || '/bin/bash'
}

// Check for idle sessions and emit events
function checkIdleSessions(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return

  const now = Date.now()
  for (const [taskId, session] of sessions) {
    const idleTime = now - session.lastOutputTime
    if (idleTime >= IDLE_TIMEOUT_MS && !session.isIdle) {
      session.isIdle = true
      mainWindow.webContents.send('pty:idle', taskId)
    }
  }
}

// Start the idle checker interval
export function startIdleChecker(win: BrowserWindow): void {
  mainWindow = win
  if (idleCheckerInterval) {
    clearInterval(idleCheckerInterval)
  }
  idleCheckerInterval = setInterval(checkIdleSessions, IDLE_CHECK_INTERVAL_MS)
}

// Stop the idle checker
export function stopIdleChecker(): void {
  if (idleCheckerInterval) {
    clearInterval(idleCheckerInterval)
    idleCheckerInterval = null
  }
  mainWindow = null
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
      checkingForSessionError: !!existingSessionId,
      buffer: '',
      lastOutputTime: Date.now(),
      isIdle: false
    })

    // Forward data to renderer
    ptyProcess.onData((data) => {
      // Append to buffer for history restoration (filter problematic sequences)
      const session = sessions.get(taskId)
      if (session) {
        session.buffer += filterBufferData(data)
        // Trim buffer if it exceeds max size (keep the most recent data)
        if (session.buffer.length > MAX_BUFFER_SIZE) {
          session.buffer = session.buffer.slice(-MAX_BUFFER_SIZE)
        }
        // Update idle tracking
        session.lastOutputTime = Date.now()
        session.isIdle = false
      }

      if (!win.isDestroyed()) {
        win.webContents.send('pty:data', taskId, data)
        
        // Check for session not found error (only in the first few seconds)
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

export function getBuffer(taskId: string): string | null {
  const session = sessions.get(taskId)
  return session?.buffer ?? null
}

export function listPtys(): PtyInfo[] {
  const result: PtyInfo[] = []
  for (const [taskId, session] of sessions) {
    result.push({
      taskId,
      lastOutputTime: session.lastOutputTime,
      isIdle: session.isIdle
    })
  }
  return result
}

export function killAllPtys(): void {
  for (const [taskId] of sessions) {
    killPty(taskId)
  }
}
