import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { homedir, userInfo } from 'os'
import type { TerminalState, PtyInfo, CodeMode } from '@omgslayzone/terminal/shared'
import { RingBuffer } from './ring-buffer'
import { getAdapter, type TerminalMode, type TerminalAdapter, type ActivityState, type ErrorInfo } from './adapters'

interface PtySession {
  pty: pty.IPty
  taskId: string
  mode: TerminalMode
  adapter: TerminalAdapter
  checkingForSessionError?: boolean
  buffer: RingBuffer
  lastOutputTime: number
  state: TerminalState
  // CLI state tracking
  activity: ActivityState
  error: ErrorInfo | null
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

// Filter out terminal escape sequences that shouldn't be replayed
function filterBufferData(data: string): string {
  return data
    // Filter OSC sequences (ESC ] ... BEL or ESC ] ... ST)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // Filter DA responses (ESC [ ? ... c)
    .replace(/\x1b\[\?[0-9;]*c/g, '')
}

// Map ActivityState to TerminalState for backward compatibility
function activityToTerminalState(activity: ActivityState): TerminalState | null {
  switch (activity) {
    case 'idle':
      return 'idle'
    case 'thinking':
    case 'tool_use':
      return 'running'
    case 'awaiting_input':
      return 'awaiting_input'
    default:
      return null
  }
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

// Check for idle sessions and transition state (fallback timeout)
function checkIdleSessions(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return

  const now = Date.now()
  for (const [taskId, session] of sessions) {
    const timeout = session.adapter.idleTimeoutMs ?? IDLE_TIMEOUT_MS
    const idleTime = now - session.lastOutputTime
    if (idleTime >= timeout && session.state === 'running') {
      session.activity = 'idle'
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
  initialPrompt?: string | null,
  dangerouslySkipPermissions?: boolean,
  codeMode?: CodeMode | null
): { success: boolean; error?: string } {
  console.log(`[pty-manager] createPty(${taskId}) mode=${mode} shell=${globalShell} skipPerms=${dangerouslySkipPermissions} codeMode=${codeMode}`)
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
    const spawnConfig = adapter.buildSpawnConfig(cwd || homedir(), conversationId || undefined, resuming, globalShell || undefined, initialPrompt || undefined, dangerouslySkipPermissions, codeMode || undefined)

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
      // CLI state tracking
      activity: 'unknown',
      error: null,
      // /status monitoring
      inputBuffer: '',
      watchingForSessionId: false,
      statusOutputBuffer: ''
    })

    // Transition out of 'starting' once setup completes
    // (pty.spawn is synchronous, so process is already running)
    setImmediate(() => {
      const session = sessions.get(taskId)
      if (session?.state === 'starting') {
        session.activity = 'idle'
        transitionState(taskId, 'idle')
      }
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

      // Use adapter for activity detection
      const detectedActivity = session.adapter.detectActivity(data, session.activity)
      if (detectedActivity) {
        session.activity = detectedActivity
        // Map activity to TerminalState for backward compatibility
        const newState = activityToTerminalState(detectedActivity)
        if (newState) transitionState(taskId, newState)
      } else if (session.state === 'starting') {
        // No spinner detected from 'starting' - assume idle (Claude showing prompt)
        session.activity = 'idle'
        transitionState(taskId, 'idle')
      }
      // Note: Don't auto-transition from 'idle' to 'running' on any output.
      // Claude CLI outputs cursor/ANSI codes while waiting. Let detectActivity
      // handle the transition when it sees actual work (spinner chars).

      // Use adapter for error detection
      const detectedError = session.adapter.detectError(data)
      if (detectedError) {
        session.error = detectedError
        session.checkingForSessionError = false
        transitionState(taskId, 'error')
        if (!win.isDestroyed() && detectedError.code === 'SESSION_NOT_FOUND') {
          win.webContents.send('pty:session-not-found', taskId)
        }
      }

      // Check for prompts
      const prompt = session.adapter.detectPrompt(data)
      if (prompt && !win.isDestroyed()) {
        win.webContents.send('pty:prompt', taskId, prompt)
      }

      if (!win.isDestroyed()) {
        win.webContents.send('pty:data', taskId, data)
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

  // Buffer input to detect commands
  session.inputBuffer += data

  // Check for /status command (on Enter)
  if (data === '\r' || data === '\n') {
    if (session.inputBuffer.includes('/status')) {
      session.watchingForSessionId = true
      session.statusOutputBuffer = ''

      // Stop watching after 5s timeout
      session.statusWatchTimeout = setTimeout(() => {
        if (session.watchingForSessionId) {
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
