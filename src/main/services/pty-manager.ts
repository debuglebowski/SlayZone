import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { homedir, userInfo } from 'os'
import type { TerminalState, PtyInfo } from '../../shared/types/api'
import { RingBuffer } from './ring-buffer'
import { getAdapter, type TerminalMode, type TerminalAdapter } from './adapters'

interface PtySession {
  pty: pty.IPty
  taskId: string
  mode: TerminalMode
  adapter: TerminalAdapter
  checkingForSessionError?: boolean
  buffer: RingBuffer
  lastOutputTime: number
  state: TerminalState
  // /status monitoring
  inputBuffer: string
  watchingForSessionId: boolean
  statusOutputBuffer: string
  statusWatchTimeout?: NodeJS.Timeout
}

export type { PtyInfo }

const sessions = new Map<string, PtySession>()

// Maximum buffer size (5MB) per session
const MAX_BUFFER_SIZE = 5 * 1024 * 1024

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

// Transition session state and emit event
function transitionState(taskId: string, newState: TerminalState): void {
  const session = sessions.get(taskId)
  if (!session || session.state === newState) return

  const oldState = session.state
  session.state = newState

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pty:state-change', taskId, newState, oldState)
    // Also emit legacy idle event for backward compatibility
    if (newState === 'idle') {
      mainWindow.webContents.send('pty:idle', taskId)
    }
  }
}

// Check for idle sessions and transition state
function checkIdleSessions(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return

  const now = Date.now()
  for (const [taskId, session] of sessions) {
    const idleTime = now - session.lastOutputTime
    if (idleTime >= IDLE_TIMEOUT_MS && session.state === 'running') {
      transitionState(taskId, 'idle')
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

export interface CreatePtyOptions {
  win: BrowserWindow
  taskId: string
  cwd: string
  mode?: TerminalMode
  conversationId?: string | null
  resuming?: boolean
}

export function createPty(
  win: BrowserWindow,
  taskId: string,
  cwd: string,
  sessionId?: string | null,
  existingSessionId?: string | null,
  mode?: TerminalMode,
  globalShell?: string | null,
  initialPrompt?: string | null
): { success: boolean; error?: string } {
  console.log(`[pty-manager] createPty(${taskId}) mode=${mode} shell=${globalShell}`)
  // Kill existing if any
  if (sessions.has(taskId)) {
    console.log(`[pty-manager] createPty(${taskId}) - killing existing PTY first`)
    killPty(taskId)
  }

  try {
    const terminalMode = mode || 'claude-code'
    const adapter = getAdapter(terminalMode)
    const resuming = !!existingSessionId
    const conversationId = existingSessionId || sessionId

    // Get spawn config from adapter
    const spawnConfig = adapter.buildSpawnConfig(cwd || homedir(), conversationId || undefined, resuming, globalShell || undefined, initialPrompt || undefined)

    const ptyProcess = pty.spawn(spawnConfig.shell, spawnConfig.args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd || homedir(),
      env: {
        ...process.env,
        ...spawnConfig.env,
        USER: process.env.USER || userInfo().username,
        HOME: process.env.HOME || homedir(),
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      } as Record<string, string>
    })

    sessions.set(taskId, {
      pty: ptyProcess,
      taskId,
      mode: terminalMode,
      adapter,
      // Only check for session errors if we're trying to resume
      checkingForSessionError: resuming,
      buffer: new RingBuffer(MAX_BUFFER_SIZE),
      lastOutputTime: Date.now(),
      state: 'starting',
      // /status monitoring
      inputBuffer: '',
      watchingForSessionId: false,
      statusOutputBuffer: ''
    })

    // Forward data to renderer
    ptyProcess.onData((data) => {
      // Only process if session still exists (prevents data leaking after kill)
      const session = sessions.get(taskId)
      if (!session) {
        console.log(`[pty-manager] onData(${taskId}) - NO SESSION, ignoring ${data.length} chars`)
        return
      }

      // Append to buffer for history restoration (filter problematic sequences)
      session.buffer.append(filterBufferData(data))
      // Update idle tracking
      session.lastOutputTime = Date.now()

      // Use adapter for state detection
      const detectedState = session.adapter.detectState(data, session.state)
      if (detectedState) {
        transitionState(taskId, detectedState)
      } else if (session.state === 'starting' || session.state === 'idle') {
        // Default: transition to running on any output
        transitionState(taskId, 'running')
      }

      // Check for prompts
      const prompt = session.adapter.detectPrompt(data)
      if (prompt && !win.isDestroyed()) {
        win.webContents.send('pty:prompt', taskId, prompt)
      }

      if (!win.isDestroyed()) {
        win.webContents.send('pty:data', taskId, data)

        // Check for session not found error (only in the first few seconds)
        if (session.checkingForSessionError && SESSION_NOT_FOUND_PATTERN.test(data)) {
          // Stop checking after we find the error
          session.checkingForSessionError = false
          transitionState(taskId, 'error')
          win.webContents.send('pty:session-not-found', taskId)
        }
      }

      // Parse session ID from /status output
      if (session.watchingForSessionId) {
        session.statusOutputBuffer += data

        const uuidMatch = session.statusOutputBuffer.match(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
        )
        if (uuidMatch) {
          const detectedSessionId = uuidMatch[0]
          console.log(`[pty-manager] Session ID detected: ${detectedSessionId}`)
          if (!win.isDestroyed()) {
            win.webContents.send('pty:session-detected', taskId, detectedSessionId)
          }
          session.watchingForSessionId = false
          session.statusOutputBuffer = ''
          if (session.statusWatchTimeout) {
            clearTimeout(session.statusWatchTimeout)
            session.statusWatchTimeout = undefined
          }
        }
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      transitionState(taskId, 'dead')
      sessions.delete(taskId)
      if (!win.isDestroyed()) {
        win.webContents.send('pty:exit', taskId, exitCode)
      }
    })

    // If adapter has post-spawn command, execute it after shell is ready
    if (spawnConfig.postSpawnCommand) {
      // Small delay to let shell initialize
      setTimeout(() => {
        if (sessions.has(taskId)) {
          ptyProcess.write(`${spawnConfig.postSpawnCommand}\r`)
        }
      }, 100)
    }

    // Stop checking for session errors after 5 seconds
    if (resuming) {
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

  // Debug: log all input
  console.log(`[pty-manager] writePty(${taskId}) data=${JSON.stringify(data)}`)

  // Buffer input to detect commands
  session.inputBuffer += data

  // Check for /status command (on Enter)
  if (data === '\r' || data === '\n') {
    console.log(`[pty-manager] Enter detected, inputBuffer=${JSON.stringify(session.inputBuffer)}`)
    if (session.inputBuffer.includes('/status')) {
      console.log(`[pty-manager] /status command detected for task ${taskId}`)
      session.watchingForSessionId = true
      session.statusOutputBuffer = ''

      // Stop watching after 5s timeout
      session.statusWatchTimeout = setTimeout(() => {
        if (session.watchingForSessionId) {
          console.log(`[pty-manager] /status watch timeout, no session ID found`)
          session.watchingForSessionId = false
          session.statusOutputBuffer = ''
        }
      }, 5000)
    }
    session.inputBuffer = '' // reset on enter
  }

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
  if (!session) {
    console.log(`[pty-manager] killPty(${taskId}) - no session found`)
    return false
  }
  console.log(`[pty-manager] killPty(${taskId}) - deleting session and killing PTY`)
  // Delete from map FIRST so onData handlers exit early during kill
  sessions.delete(taskId)
  // Use SIGKILL (9) to forcefully terminate - SIGTERM may not kill child processes
  session.pty.kill('SIGKILL')
  console.log(`[pty-manager] killPty(${taskId}) - done`)
  return true
}

export function hasPty(taskId: string): boolean {
  return sessions.has(taskId)
}

export function getBuffer(taskId: string): string | null {
  const session = sessions.get(taskId)
  return session?.buffer.toString() ?? null
}

export function listPtys(): PtyInfo[] {
  const result: PtyInfo[] = []
  for (const [taskId, session] of sessions) {
    result.push({
      taskId,
      lastOutputTime: session.lastOutputTime,
      state: session.state
    })
  }
  return result
}

export function getState(taskId: string): TerminalState | null {
  const session = sessions.get(taskId)
  return session?.state ?? null
}

export function killAllPtys(): void {
  for (const [taskId] of sessions) {
    killPty(taskId)
  }
}
