import { spawn as realSpawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import readline from 'node:readline'
import type { AgentEvent } from '../shared/agent-events'
import type { AgentAdapter } from './agents/types'
import { getAdapter } from './agents/registry'
import { whichBinary as realWhichBinary } from './shell-env'

/** Dependency-injection seam for tests. */
export interface TransportDeps {
  spawn: (cmd: string, args: string[], opts: SpawnOptions) => ChildProcess
  whichBinary: (name: string) => Promise<string | null>
  broadcastEvent: (tabId: string, event: AgentEvent, seq: number) => void
  broadcastExit: (tabId: string, code: number | null, signal: string | null) => void
}

/**
 * Default broadcast uses Electron's BrowserWindow. We require it lazily so that
 * non-electron test runs can import this module without pulling in `electron`.
 */
function electronBroadcast(channel: 'chat:event' | 'chat:exit'): (...args: unknown[]) => void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BrowserWindow } = require('electron') as typeof import('electron')
  return (...args: unknown[]) => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (w.isDestroyed()) continue
      w.webContents.send(channel, ...args)
    }
  }
}

const defaultDeps: TransportDeps = {
  spawn: realSpawn,
  whichBinary: realWhichBinary,
  broadcastEvent: (tabId, event, seq) => {
    electronBroadcast('chat:event')(tabId, event, seq)
  },
  broadcastExit: (tabId, code, signal) => {
    electronBroadcast('chat:exit')(tabId, code, signal)
  },
}

let deps: TransportDeps = defaultDeps

export function setTransportDepsForTests(override: Partial<TransportDeps>): void {
  deps = { ...defaultDeps, ...override }
}

export function resetTransportDeps(): void {
  deps = defaultDeps
}

export interface ChatSessionInfo {
  sessionId: string
  tabId: string
  mode: string
  cwd: string
  pid: number | null
  startedAt: string
  ended: boolean
}

interface BufferedEvent {
  seq: number
  event: AgentEvent
}

interface Session {
  sessionId: string
  tabId: string
  mode: string
  cwd: string
  adapter: AgentAdapter
  child: ChildProcess
  buffer: BufferedEvent[]
  nextSeq: number
  ended: boolean
  startedAt: string
  /** True if this spawn used --resume (vs fresh --session-id). */
  usedResume: boolean
  /** True once we received any confirmation that the session is healthy. */
  sawHealthyTurn: boolean
  /** True once we've triggered a retry spawn. Prevents retry loops. */
  retryScheduled: boolean
  /** Opts needed to respawn. */
  respawnOpts: CreateChatOpts
  onPersistSessionId?: (id: string) => void
  onInvalidResume?: () => void
}

const MAX_BUFFER_EVENTS = 2000
const STDERR_FLUSH_INTERVAL_MS = 100

const sessions = new Map<string, Session>()

function appendToBuffer(session: Session, event: AgentEvent): number {
  const seq = session.nextSeq++
  session.buffer.push({ seq, event })
  if (session.buffer.length > MAX_BUFFER_EVENTS) {
    session.buffer.splice(0, session.buffer.length - MAX_BUFFER_EVENTS)
  }
  return seq
}

function handleEvent(session: Session, event: AgentEvent): void {
  const seq = appendToBuffer(session, event)
  deps.broadcastEvent(session.tabId, event, seq)

  // Mark session as healthy once we see any real content.
  if (
    event.kind === 'assistant-text' ||
    event.kind === 'tool-call' ||
    event.kind === 'result' && !event.isError
  ) {
    session.sawHealthyTurn = true
  }

  // Detect invalid --resume: Claude prints 'No conversation found with session ID' before exit.
  // Clear the stored id so next spawn starts fresh.
  if (session.usedResume && !session.sawHealthyTurn) {
    const text = detectResumeFailure(event)
    if (text) {
      if (session.onInvalidResume) {
        session.onInvalidResume()
        session.onInvalidResume = undefined
      }
      // Auto-retry fresh once. Schedule after current event tick so parse flush completes.
      const autoRetry = session.respawnOpts.autoRetryOnInvalidResume !== false
      if (autoRetry && !session.retryScheduled) {
        session.retryScheduled = true
        setImmediate(() => {
          void respawnFresh(session)
        })
      }
    }
  }

  // Surface discovered session id for persistence (resume-on-reopen).
  const extracted = session.adapter.extractSessionId(event)
  if (extracted && session.onPersistSessionId) {
    session.onPersistSessionId(extracted)
  }
}

async function respawnFresh(session: Session): Promise<void> {
  // Kill current (if not already gone) and wait for exit, then spawn fresh.
  try {
    if (!session.ended) {
      session.child.kill('SIGTERM')
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 2000)
        session.child.once('exit', () => {
          clearTimeout(t)
          resolve()
        })
      })
    }
  } catch {
    /* ignore */
  }
  // Remove before recreate so createChat treats tabId as fresh.
  sessions.delete(session.tabId)
  const nextOpts: CreateChatOpts = {
    ...session.respawnOpts,
    conversationId: null,
    // Don't loop: disable retry on the second attempt.
    autoRetryOnInvalidResume: false,
  }
  try {
    await createChat(nextOpts)
  } catch (e) {
    console.error('[chat-transport] auto-retry after invalid resume failed:', e)
  }
}

function detectResumeFailure(event: AgentEvent): string | null {
  if (event.kind === 'stderr' && /no conversation found/i.test(event.text)) {
    return event.text
  }
  if (event.kind === 'result' && event.isError) {
    const txt = event.text ?? ''
    if (/no conversation found/i.test(txt)) return txt
    if (event.subtype === 'error_during_execution' && event.numTurns === 0) return 'resume failed'
  }
  return null
}

export interface CreateChatOpts {
  tabId: string
  mode: string
  cwd: string
  /** If set, --resume <id>; otherwise fresh --session-id <newUuid>. */
  conversationId: string | null
  /** Shell-parsed flags (e.g. ['--allow-dangerously-skip-permissions']). */
  providerFlags: string[]
  /** Extra env overrides (PATH enrichment already applied by caller or inherited). */
  env?: NodeJS.ProcessEnv
  /** Callback when adapter discovers a session_id in the stream. Persist via setProviderConversationId. */
  onPersistSessionId?: (id: string) => void
  /** Called when --resume was attempted but the stored session id is invalid. Clear it. */
  onInvalidResume?: () => void
  /**
   * If true, transport auto-retries a single fresh spawn when --resume is rejected.
   * Default true. Renderer sees one brief exit, then a fresh turn-init for the same tab.
   */
  autoRetryOnInvalidResume?: boolean
}

export async function createChat(opts: CreateChatOpts): Promise<ChatSessionInfo> {
  // Refuse duplicate sessions for one tab.
  const existing = sessions.get(opts.tabId)
  if (existing && !existing.ended) {
    return toInfo(existing)
  }

  const adapter = getAdapter(opts.mode)
  if (!adapter) {
    throw new ChatTransportError(`No agent adapter registered for mode "${opts.mode}"`)
  }

  const binary = await deps.whichBinary(adapter.binaryName)
  if (!binary) {
    throw new ChatTransportError(
      `Binary "${adapter.binaryName}" not found on PATH. Install it or fix your shell's PATH.`
    )
  }

  const sessionId = opts.conversationId || randomUUID()
  const { args } = adapter.buildSpawnArgs({
    sessionId,
    resume: Boolean(opts.conversationId),
    cwd: opts.cwd,
    providerFlags: opts.providerFlags,
  })

  const child = deps.spawn(binary, args, {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
  })

  const session: Session = {
    sessionId,
    tabId: opts.tabId,
    mode: opts.mode,
    cwd: opts.cwd,
    adapter,
    child,
    buffer: [],
    nextSeq: 0,
    ended: false,
    startedAt: new Date().toISOString(),
    usedResume: Boolean(opts.conversationId),
    sawHealthyTurn: false,
    retryScheduled: false,
    respawnOpts: opts,
    onPersistSessionId: opts.onPersistSessionId,
    onInvalidResume: opts.onInvalidResume,
  }
  sessions.set(opts.tabId, session)

  // --- stdout: readline buffers partial lines for us ---
  const rl = readline.createInterface({ input: child.stdout!, crlfDelay: Infinity })
  rl.on('line', (line) => {
    const ev = adapter.parseLine(line)
    if (!ev) return
    if (ev.kind === 'unknown' && ev.reason === 'unknown-type') {
      // Surface unknown top-level types once, tagged for log filtering.
      const raw = ev.raw as { type?: string } | null
      const t = raw?.type ?? '<no-type>'
      console.warn(`[chat-parser] unknown event type=${t}`)
    }
    handleEvent(session, ev)
  })

  // --- stderr: debounced buffer, emit as kind:'stderr' ---
  let stderrBuf = ''
  let stderrTimer: NodeJS.Timeout | null = null
  const flushStderr = (): void => {
    stderrTimer = null
    if (!stderrBuf) return
    const text = stderrBuf
    stderrBuf = ''
    handleEvent(session, { kind: 'stderr', text })
  }
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString()
    if (!stderrTimer) stderrTimer = setTimeout(flushStderr, STDERR_FLUSH_INTERVAL_MS)
  })

  // --- exit ---
  child.on('exit', (code, signal) => {
    if (stderrTimer) {
      clearTimeout(stderrTimer)
      flushStderr()
    }
    session.ended = true
    handleEvent(session, { kind: 'process-exit', code, signal })
    deps.broadcastExit(opts.tabId, code, signal)
    // Leave session in map so reattach can read buffer; consumer deletes on tab close.
  })

  child.on('error', (err) => {
    handleEvent(session, {
      kind: 'error',
      message: err.message,
      detail: { name: err.name },
    })
  })

  return toInfo(session)
}

export function sendUserMessage(tabId: string, text: string): boolean {
  const session = sessions.get(tabId)
  if (!session || session.ended) return false
  const line = session.adapter.serializeUserMessage(text, session.sessionId)
  session.child.stdin?.write(line + '\n')
  return true
}

/**
 * Interrupt semantics per Spike C: SIGINT unreliable. Default strategy = kill + respawn.
 * Caller (hook) orchestrates respawn via --resume; this method just terminates.
 */
export function interrupt(tabId: string): void {
  kill(tabId)
}

export function kill(tabId: string): void {
  const session = sessions.get(tabId)
  if (!session) return
  if (session.ended) return
  try {
    session.child.kill('SIGTERM')
  } catch {
    // process may already be gone
  }
  setTimeout(() => {
    if (!session.ended) {
      try {
        session.child.kill('SIGKILL')
      } catch {
        // ignore
      }
    }
  }, 2000)
}

/**
 * Remove the session entirely (for tab close). Kills first if still live.
 */
export function removeSession(tabId: string): void {
  const session = sessions.get(tabId)
  if (!session) return
  if (!session.ended) kill(tabId)
  sessions.delete(tabId)
}

export function getEventBufferSince(tabId: string, afterSeq: number): BufferedEvent[] {
  const session = sessions.get(tabId)
  if (!session) return []
  return session.buffer.filter((b) => b.seq > afterSeq)
}

export function getSessionInfo(tabId: string): ChatSessionInfo | null {
  const session = sessions.get(tabId)
  return session ? toInfo(session) : null
}

function toInfo(session: Session): ChatSessionInfo {
  return {
    sessionId: session.sessionId,
    tabId: session.tabId,
    mode: session.mode,
    cwd: session.cwd,
    pid: session.child.pid ?? null,
    startedAt: session.startedAt,
    ended: session.ended,
  }
}

/** Kill all sessions (app shutdown). */
export function killAll(): void {
  for (const tabId of sessions.keys()) kill(tabId)
}

export class ChatTransportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChatTransportError'
  }
}

/** For tests: inspect + clear state. */
export function __resetForTests(): void {
  sessions.clear()
}
