import { useCallback, useEffect, useRef, useState } from 'react'
import { toast, type AgentMode, type AutoModeCapability } from '@slayzone/ui'
import { rawPermissionModeToChatMode } from '@slayzone/terminal/shared'

/**
 * Minimal ChatSessionInfo shape — kept inline (instead of importing the full
 * type) to avoid pulling @slayzone/types into task-terminals just for one
 * field. Only `chatMode` is read here; other fields are intentionally untyped.
 */
interface SessionInfoLite {
  chatMode?: AgentMode | null
}

interface UseChatModeOpts {
  taskId: string
  mode: string
  tabId: string
  cwd: string
  /**
   * Live raw permission mode from the running subprocess (via `useChatSession`).
   * Drives drift sync via transition tracking — applied only when value
   * *changes* from last-applied, never on stale renders. Updated on session
   * start / kill+respawn (turn-init).
   */
  livePermissionMode?: string | null
}

interface ChatModeApi {
  setMode: (opts: { tabId: string; taskId: string; mode: string; cwd: string; chatMode: AgentMode }) => Promise<SessionInfoLite>
  getMode: (taskId: string, mode: string) => Promise<AgentMode>
  getInfo: (tabId: string) => Promise<SessionInfoLite | null>
  getAutoEligibility?: () => Promise<AutoModeCapability>
}

function getApi(): ChatModeApi {
  return (window as unknown as { api: { chat: ChatModeApi } }).api.chat
}

/**
 * Owns chat-permission-mode state. Server-authoritative model:
 *
 *   - Mount hydration: prefer `chat:getInfo` (in-memory `Session.chatMode`,
 *     fresher than DB) → fall back to `chat:getMode` (DB cache) when no
 *     session exists yet.
 *   - User-driven change: `chat:setMode` returns the *resolved* `ChatMode`
 *     after the new subprocess has spawned (transactional); state mirrors
 *     that return value, not optimistic intent. Eliminates the historical
 *     race where a stale `livePermissionMode` reverted optimistic state
 *     before the new turn-init arrived.
 *   - External drift: `livePermissionMode` transitions (not equality checks)
 *     update state. A stale render where the value matches last-applied is
 *     a no-op, so it cannot override a freshly server-confirmed mode.
 *
 * Extracted from ChatPanel to keep the panel component focused on layout and
 * keep mode wiring testable in isolation.
 */
export function useChatMode({ taskId, mode, tabId, cwd, livePermissionMode }: UseChatModeOpts) {
  const [chatMode, setChatModeState] = useState<AgentMode>('auto-accept')
  const [modeChanging, setModeChanging] = useState(false)
  const [autoCapability, setAutoCapability] = useState<AutoModeCapability>({ eligible: false, optedIn: false })
  const lastAppliedLiveRef = useRef<string | null | undefined>(undefined)

  // Hydrate on mount. Live session > DB cache.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const info = await getApi().getInfo(tabId)
        if (cancelled) return
        if (info?.chatMode) {
          setChatModeState(info.chatMode)
          return
        }
        const cached = await getApi().getMode(taskId, mode)
        if (!cancelled) setChatModeState(cached)
      } catch {
        /* keep default */
      }
    })()
    return () => { cancelled = true }
  }, [taskId, mode, tabId])

  // Drift sync: apply live permission mode only on transitions. A stale
  // render where livePermissionMode equals the last-applied value is a no-op,
  // so it cannot revert an optimistically-pending or freshly-confirmed mode
  // change.
  useEffect(() => {
    if (livePermissionMode === lastAppliedLiveRef.current) return
    lastAppliedLiveRef.current = livePermissionMode
    if (modeChanging) return
    const mapped = rawPermissionModeToChatMode(livePermissionMode) as AgentMode | null
    if (mapped && mapped !== chatMode) setChatModeState(mapped)
  }, [livePermissionMode, modeChanging, chatMode])

  useEffect(() => {
    let cancelled = false
    const fn = getApi().getAutoEligibility
    if (!fn) return
    void fn()
      .then((cap) => { if (!cancelled) setAutoCapability(cap) })
      .catch(() => { /* keep default (hidden) */ })
    return () => { cancelled = true }
  }, [])

  const handleModeChange = useCallback(async (next: AgentMode) => {
    if (next === chatMode || modeChanging) return
    if (next === 'auto' && !autoCapability.optedIn) {
      toast('Auto mode requires Max/Team/Enterprise + opt-in via `claude` CLI')
      return
    }
    setModeChanging(true)
    try {
      const info = await getApi().setMode({ tabId, taskId, mode, cwd, chatMode: next })
      // Trust the server-resolved mode (e.g. `auto` may downgrade to
      // `auto-accept` when capability is missing). No optimistic state —
      // the brief delay (~spawn time) is worth the elimination of revert
      // races.
      if (info?.chatMode) setChatModeState(info.chatMode)
      else setChatModeState(next)
    } catch (err) {
      toast(`Mode change failed: ${err instanceof Error ? err.message : String(err)}`)
      // No state change on failure — chatMode stays at previous confirmed value.
    } finally {
      setModeChanging(false)
    }
  }, [chatMode, modeChanging, autoCapability.optedIn, tabId, taskId, mode, cwd])

  return { chatMode, modeChanging, handleModeChange, autoCapability }
}
