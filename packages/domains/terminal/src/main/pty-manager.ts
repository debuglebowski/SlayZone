import * as pty from 'node-pty'
import { BrowserWindow, Notification, nativeTheme } from 'electron'
import { homedir, userInfo } from 'os'
import type { Database } from 'better-sqlite3'
import type { TerminalState, PtyInfo, CodeMode, BufferSinceResult } from '@slayzone/terminal/shared'
import { getDiagnosticsConfig, recordDiagnosticEvent } from '@slayzone/diagnostics/main'
import { RingBuffer, type BufferChunk } from './ring-buffer'
import { getAdapter, type TerminalMode, type TerminalAdapter, type ActivityState, type ErrorInfo } from './adapters'

// Database reference for notifications
let db: Database | null = null

export function setDatabase(database: Database): void {
  db = database
}

function showTaskAttentionNotification(sessionId: string): void {
  if (!db) return

  // Check if desktop notifications are enabled
  const settingsRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('notificationPanelState') as { value: string } | undefined
  if (settingsRow?.value) {
    try {
      const state = JSON.parse(settingsRow.value)
      if (!state.desktopEnabled) return
    } catch {
      return
    }
  } else {
    return // No settings = disabled by default
  }

  // Get task title
  const taskId = sessionId.split(':')[0]
  const taskRow = db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId) as { title: string } | undefined
  if (taskRow?.title) {
    new Notification({
      title: 'Attention needed',
      body: taskRow.title
    }).show()
  }
}

export type { BufferChunk }

interface PtySession {
  win: BrowserWindow
  pty: pty.IPty
  sessionId: string
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
const stateDebounceTimers = new Map<string, NodeJS.Timeout>()

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

function taskIdFromSessionId(sessionId: string): string {
  return sessionId.split(':')[0] || sessionId
}

// Filter out terminal escape sequences that cause issues
function filterBufferData(data: string): string {
  return data
    // Strip only title-setting (0,1,2) and clipboard (52) OSC sequences
    // Allow through: OSC 10/11 (color query), OSC 4 (palette), OSC 7 (CWD) etc.
    .replace(/\x1b\](?:[012]|52)[;][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // Filter DA responses (ESC [ ? ... c)
    .replace(/\x1b\[\?[0-9;]*c/g, '')
    // Filter underline from ANY SGR sequence (handles combined codes like ESC[1;4m)
    // Claude Code outputs these and they persist incorrectly in xterm.js
    .replace(/\x1b\[([0-9;:]*)m/g, (_match, params) => {
      if (!params) return '\x1b[m'
      // Split only by semicolon - colon is subparameter separator (4:3 = curly underline)
      const filtered = params.split(';')
        .filter((p: string) => p !== '4' && !p.startsWith('4:'))
        .join(';')
      return filtered ? `\x1b[${filtered}m` : ''
    })
}

// Map ActivityState to TerminalState
function activityToTerminalState(activity: ActivityState): TerminalState | null {
  switch (activity) {
    case 'attention':
      return 'attention'
    case 'working':
      return 'running'
    default:
      return null
  }
}

// Emit state change via IPC
function emitStateChange(session: PtySession, sessionId: string, newState: TerminalState, oldState: TerminalState): void {
  recordDiagnosticEvent({
    level: 'info',
    source: 'pty',
    event: 'pty.state_change',
    sessionId,
    taskId: taskIdFromSessionId(sessionId),
    message: `${oldState} -> ${newState}`,
    payload: {
      oldState,
      newState
    }
  })

  if (oldState === 'running' && newState === 'attention') {
    showTaskAttentionNotification(sessionId)
  }
  if (session.win && !session.win.isDestroyed()) {
    try {
      session.win.webContents.send('pty:state-change', sessionId, newState, oldState)
      if (newState === 'attention') {
        session.win.webContents.send('pty:attention', sessionId)
      }
    } catch { /* Window destroyed */ }
  }
}

// Transition session state (asymmetric debounce: immediate for 'running', 100ms for others)
function transitionState(sessionId: string, newState: TerminalState): void {
  const session = sessions.get(sessionId)
  if (!session) return

  // Clear any pending timer
  const pending = stateDebounceTimers.get(sessionId)
  if (pending) {
    clearTimeout(pending)
    stateDebounceTimers.delete(sessionId)
  }

  if (session.state === newState) return

  // Immediate transition for 'running' (work resumed, show it right away)
  // Debounced transition for 'attention' (prevent flicker during output gaps)
  if (newState === 'running') {
    const oldState = session.state
    session.state = newState
    emitStateChange(session, sessionId, newState, oldState)
  } else {
    // Debounce 100ms for attention/error/dead/starting
    stateDebounceTimers.set(sessionId, setTimeout(() => {
      stateDebounceTimers.delete(sessionId)
      const session = sessions.get(sessionId)
      if (!session || session.state === newState) return
      const oldState = session.state
      session.state = newState
      emitStateChange(session, sessionId, newState, oldState)
    }, 100))
  }
}

// Check for inactive sessions and transition state (fallback timeout)
function checkInactiveSessions(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return

  const now = Date.now()
  for (const [sessionId, session] of sessions) {
    const timeout = session.adapter.idleTimeoutMs ?? IDLE_TIMEOUT_MS
    const inactiveTime = now - session.lastOutputTime
    if (inactiveTime >= timeout && session.state === 'running') {
      session.activity = 'attention'
      transitionState(sessionId, 'attention')
    }
  }
}

// Start the inactivity checker interval
export function startIdleChecker(win: BrowserWindow): void {
  mainWindow = win
  if (idleCheckerInterval) {
    clearInterval(idleCheckerInterval)
  }
  idleCheckerInterval = setInterval(checkInactiveSessions, IDLE_CHECK_INTERVAL_MS)
}

// Stop the inactivity checker
export function stopIdleChecker(): void {
  if (idleCheckerInterval) {
    clearInterval(idleCheckerInterval)
    idleCheckerInterval = null
  }
  mainWindow = null
}

export interface CreatePtyOptions {
  win: BrowserWindow
  sessionId: string
  cwd: string
  mode?: TerminalMode
  conversationId?: string | null
  resuming?: boolean
}

export function createPty(
  win: BrowserWindow,
  sessionId: string,
  cwd: string,
  conversationId?: string | null,
  existingConversationId?: string | null,
  mode?: TerminalMode,
  globalShell?: string | null,
  initialPrompt?: string | null,
  providerArgs?: string[],
  codeMode?: CodeMode | null
): { success: boolean; error?: string } {
  recordDiagnosticEvent({
    level: 'info',
    source: 'pty',
    event: 'pty.create',
    sessionId,
    taskId: taskIdFromSessionId(sessionId),
    payload: {
      mode: mode ?? null,
      shell: globalShell ?? null,
      providerArgs: providerArgs ?? [],
      codeMode: codeMode ?? null,
      hasConversationId: Boolean(conversationId),
      hasExistingConversationId: Boolean(existingConversationId)
    }
  })

  // Kill existing if any
  if (sessions.has(sessionId)) {
    recordDiagnosticEvent({
      level: 'warn',
      source: 'pty',
      event: 'pty.replace_existing',
      sessionId,
      taskId: taskIdFromSessionId(sessionId)
    })
    killPty(sessionId)
  }

  try {
    const terminalMode = mode || 'claude-code'
    const adapter = getAdapter(terminalMode)
    const resuming = !!existingConversationId
    const effectiveConversationId = existingConversationId || conversationId

    // Get spawn config from adapter
    const spawnConfig = adapter.buildSpawnConfig(cwd || homedir(), effectiveConversationId || undefined, resuming, globalShell || undefined, initialPrompt || undefined, providerArgs ?? [], codeMode || undefined)

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
        COLORTERM: 'truecolor',
        COLORFGBG: nativeTheme.shouldUseDarkColors ? '15;0' : '0;15',
        TERM_BACKGROUND: nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
      } as Record<string, string>
    })

    sessions.set(sessionId, {
      win,
      pty: ptyProcess,
      sessionId,
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
      const session = sessions.get(sessionId)
      if (session?.state === 'starting') {
        session.activity = 'attention'
        transitionState(sessionId, 'attention')
      }
    })

    // Forward data to renderer
    ptyProcess.onData((data) => {
      // Only process if session still exists (prevents data leaking after kill)
      const session = sessions.get(sessionId)
      if (!session) {
        recordDiagnosticEvent({
          level: 'warn',
          source: 'pty',
          event: 'pty.data_without_session',
          sessionId,
          taskId: taskIdFromSessionId(sessionId),
          payload: {
            length: data.length
          }
        })
        return
      }

      // Append to buffer for history restoration (filter problematic sequences)
      const seq = session.buffer.append(filterBufferData(data))
      // Update idle tracking
      session.lastOutputTime = Date.now()
      // Track current seq for IPC emission
      const currentSeq = seq

      // Use adapter for activity detection
      const detectedActivity = session.adapter.detectActivity(data, session.activity)
      if (detectedActivity) {
        session.activity = detectedActivity
        // Clear error state on valid activity (recovery from error)
        if (session.error && detectedActivity !== 'unknown') {
          session.error = null
        }
        // Map activity to TerminalState for backward compatibility
        const newState = activityToTerminalState(detectedActivity)
        if (newState) transitionState(sessionId, newState)
      } else if (session.state === 'starting') {
        // No spinner detected from 'starting' - assume attention (Claude showing prompt)
        session.activity = 'attention'
        transitionState(sessionId, 'attention')
      }
      // Note: Don't auto-transition from 'attention' to 'running' on any output.
      // Claude CLI outputs cursor/ANSI codes while waiting. Let detectActivity
      // handle the transition when it sees actual work (spinner chars).

      // Use adapter for error detection
      const detectedError = session.adapter.detectError(data)
      if (detectedError) {
        session.error = detectedError
        session.checkingForSessionError = false
        transitionState(sessionId, 'error')
        recordDiagnosticEvent({
          level: 'error',
          source: 'pty',
          event: 'pty.adapter_error',
          sessionId,
          taskId: taskIdFromSessionId(sessionId),
          message: detectedError.message,
          payload: {
            code: detectedError.code,
            rawLength: data.length
          }
        })
        if (!win.isDestroyed() && detectedError.code === 'SESSION_NOT_FOUND') {
          try {
            win.webContents.send('pty:session-not-found', sessionId)
          } catch {
            // Window destroyed, ignore
          }
        }
      }

      // Check for prompts
      const prompt = session.adapter.detectPrompt(data)
      if (prompt && !win.isDestroyed()) {
        try {
          win.webContents.send('pty:prompt', sessionId, prompt)
        } catch {
          // Window destroyed, ignore
        }
      }

      if (!win.isDestroyed()) {
        try {
          // Filter problematic sequences before sending to renderer
          const cleanData = filterBufferData(data)
          win.webContents.send('pty:data', sessionId, cleanData, currentSeq)
        } catch {
          // Window destroyed between check and send, ignore
        }
      }

      // Parse conversation ID from /status output
      if (session.watchingForSessionId) {
        session.statusOutputBuffer += data

        const uuidMatch = session.statusOutputBuffer.match(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
        )
        if (uuidMatch) {
          const detectedConversationId = uuidMatch[0]
          recordDiagnosticEvent({
            level: 'info',
            source: 'pty',
            event: 'pty.conversation_detected',
            sessionId,
            taskId: taskIdFromSessionId(sessionId),
            payload: {
              conversationId: detectedConversationId
            }
          })
          if (!win.isDestroyed()) {
            try {
              win.webContents.send('pty:session-detected', sessionId, detectedConversationId)
            } catch {
              // Window destroyed, ignore
            }
          }
          session.watchingForSessionId = false
          session.statusOutputBuffer = ''
          if (session.statusWatchTimeout) {
            clearTimeout(session.statusWatchTimeout)
            session.statusWatchTimeout = undefined
          }
        }
      }

      const config = getDiagnosticsConfig()
      recordDiagnosticEvent({
        level: 'debug',
        source: 'pty',
        event: 'pty.data',
        sessionId,
        taskId: taskIdFromSessionId(sessionId),
        payload: config.includePtyOutput
          ? { length: data.length, data }
          : { length: data.length, included: false }
      })
    })

    ptyProcess.onExit(({ exitCode }) => {
      transitionState(sessionId, 'dead')
      sessions.delete(sessionId)
      recordDiagnosticEvent({
        level: 'info',
        source: 'pty',
        event: 'pty.exit',
        sessionId,
        taskId: taskIdFromSessionId(sessionId),
        payload: {
          exitCode
        }
      })
      if (!win.isDestroyed()) {
        try {
          win.webContents.send('pty:exit', sessionId, exitCode)
        } catch {
          // Window destroyed, ignore
        }
      }
    })

    // If adapter has post-spawn command, execute it after shell is ready
    if (spawnConfig.postSpawnCommand) {
      // Delay to let shell initialize - 250ms is conservative but reliable
      // TODO: Could improve with shell-specific ready detection
      setTimeout(() => {
        if (sessions.has(sessionId)) {
          ptyProcess.write(`${spawnConfig.postSpawnCommand}\r`)
        }
      }, 250)
    }

    // Stop checking for session errors after 5 seconds
    if (resuming) {
      setTimeout(() => {
        const session = sessions.get(sessionId)
        if (session) {
          session.checkingForSessionError = false
        }
      }, 5000)
    }

    return { success: true }
  } catch (error) {
    const err = error as Error
    recordDiagnosticEvent({
      level: 'error',
      source: 'pty',
      event: 'pty.create_failed',
      sessionId,
      taskId: taskIdFromSessionId(sessionId),
      message: err.message,
      payload: {
        stack: err.stack ?? null
      }
    })
    return { success: false, error: err.message }
  }
}

export function writePty(sessionId: string, data: string): boolean {
  const session = sessions.get(sessionId)
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

export function resizePty(sessionId: string, cols: number, rows: number): boolean {
  const session = sessions.get(sessionId)
  if (!session) return false
  // Validate bounds to prevent crashes
  const safeCols = Math.max(1, Math.min(cols, 500))
  const safeRows = Math.max(1, Math.min(rows, 500))
  session.pty.resize(safeCols, safeRows)
  return true
}

export function killPty(sessionId: string): boolean {
  const session = sessions.get(sessionId)
  if (!session) {
    recordDiagnosticEvent({
      level: 'warn',
      source: 'pty',
      event: 'pty.kill_missing',
      sessionId,
      taskId: taskIdFromSessionId(sessionId)
    })
    return false
  }
  recordDiagnosticEvent({
    level: 'info',
    source: 'pty',
    event: 'pty.kill',
    sessionId,
    taskId: taskIdFromSessionId(sessionId)
  })
  // Clear any pending timeout to prevent orphaned callbacks
  if (session.statusWatchTimeout) {
    clearTimeout(session.statusWatchTimeout)
  }
  // Clear state debounce timer
  const debounceTimer = stateDebounceTimers.get(sessionId)
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    stateDebounceTimers.delete(sessionId)
  }
  // Delete from map FIRST so onData handlers exit early during kill
  sessions.delete(sessionId)
  // Use SIGKILL (9) to forcefully terminate - SIGTERM may not kill child processes
  session.pty.kill('SIGKILL')
  return true
}

export function hasPty(sessionId: string): boolean {
  return sessions.has(sessionId)
}

export function getBuffer(sessionId: string): string | null {
  const session = sessions.get(sessionId)
  return session?.buffer.toString() ?? null
}

export function clearBuffer(sessionId: string): { success: boolean; clearedSeq: number | null } {
  const session = sessions.get(sessionId)
  if (!session) return { success: false, clearedSeq: null }

  const clearedSeq = session.buffer.getCurrentSeq()
  session.buffer.clear()
  return { success: true, clearedSeq }
}

export function getBufferSince(sessionId: string, afterSeq: number): BufferSinceResult | null {
  const session = sessions.get(sessionId)
  if (!session) return null
  return {
    chunks: session.buffer.getChunksSince(afterSeq),
    currentSeq: session.buffer.getCurrentSeq()
  }
}

export function listPtys(): PtyInfo[] {
  const result: PtyInfo[] = []
  for (const [sessionId, session] of sessions) {
    result.push({
      sessionId,
      lastOutputTime: session.lastOutputTime,
      state: session.state
    })
  }
  return result
}

export function getState(sessionId: string): TerminalState | null {
  const session = sessions.get(sessionId)
  return session?.state ?? null
}

export function killAllPtys(): void {
  for (const [taskId] of sessions) {
    killPty(taskId)
  }
}

export function killPtysByTaskId(taskId: string): void {
  const toKill = [...sessions.keys()].filter(id => id.startsWith(`${taskId}:`))
  for (const sessionId of toKill) {
    killPty(sessionId)
  }
}
