import { useCallback, useEffect, useState } from 'react'
import { toast, type AgentMode, type AutoModeCapability } from '@slayzone/ui'
import { rawPermissionModeToChatMode } from '@slayzone/terminal/shared'

interface UseChatModeOpts {
  taskId: string
  mode: string
  tabId: string
  cwd: string
  /**
   * Live raw permission mode from the running subprocess (via `useChatSession`).
   * When recognized, overrides DB-cached state — subprocess is the source of
   * truth. Updated on session start / kill+respawn (turn-init).
   */
  livePermissionMode?: string | null
}

interface ChatModeApi {
  setMode: (opts: { tabId: string; taskId: string; mode: string; cwd: string; chatMode: AgentMode }) => Promise<unknown>
  getMode: (taskId: string, mode: string) => Promise<AgentMode>
  getAutoEligibility?: () => Promise<AutoModeCapability>
}

function getApi(): ChatModeApi {
  return (window as unknown as { api: { chat: ChatModeApi } }).api.chat
}

/**
 * Owns chat-permission-mode state. Hydration: cached DB value via `chat:getMode`
 * (cold-start fallback). Live truth: `livePermissionMode` from useChatSession
 * (subprocess-reported). Mode cycling via `chat:setMode` kills + respawns the
 * subprocess with new flags.
 *
 * Priority order for displayed mode:
 *   1. `livePermissionMode` (when recognized) — subprocess is source of truth.
 *   2. DB-hydrated value — cold-start before first turn-init.
 *   3. Default 'auto-accept'.
 *
 * Extracted from ChatPanel to keep the panel component focused on layout and
 * keep mode wiring testable in isolation.
 */
export function useChatMode({ taskId, mode, tabId, cwd, livePermissionMode }: UseChatModeOpts) {
  const [chatMode, setChatModeState] = useState<AgentMode>('auto-accept')
  const [modeChanging, setModeChanging] = useState(false)
  const [autoCapability, setAutoCapability] = useState<AutoModeCapability>({ eligible: false, optedIn: false })

  useEffect(() => {
    let cancelled = false
    void getApi()
      .getMode(taskId, mode)
      .then((m) => { if (!cancelled) setChatModeState(m) })
      .catch(() => { /* keep default */ })
    return () => { cancelled = true }
  }, [taskId, mode])

  // Live subprocess-reported mode wins over cached DB value. Skip while the
  // user is mid-cycle (modeChanging) so optimistic state doesn't get clobbered
  // by an in-flight respawn that hasn't emitted its new turn-init yet.
  useEffect(() => {
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
    setChatModeState(next)
    setModeChanging(true)
    try {
      await getApi().setMode({ tabId, taskId, mode, cwd, chatMode: next })
    } catch (err) {
      toast(`Mode change failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setModeChanging(false)
    }
  }, [chatMode, modeChanging, autoCapability.optedIn, tabId, taskId, mode, cwd])

  return { chatMode, modeChanging, handleModeChange, autoCapability }
}
