import { useCallback, useEffect, useState } from 'react'
import { toast, type AgentMode } from '@slayzone/ui'

interface UseChatModeOpts {
  taskId: string
  mode: string
  tabId: string
  cwd: string
}

interface ChatModeApi {
  setMode: (opts: { tabId: string; taskId: string; mode: string; cwd: string; chatMode: AgentMode }) => Promise<unknown>
  getMode: (taskId: string, mode: string) => Promise<AgentMode>
}

function getApi(): ChatModeApi {
  return (window as unknown as { api: { chat: ChatModeApi } }).api.chat
}

/**
 * Owns chat-permission-mode state: hydration on mount via `chat:getMode`, mode
 * cycling via `chat:setMode` (which kills + respawns the subprocess with the
 * resolved flags, preserving conversation via `--resume`).
 *
 * Extracted from ChatPanel to keep the panel component focused on layout and
 * keep mode wiring testable in isolation.
 */
export function useChatMode({ taskId, mode, tabId, cwd }: UseChatModeOpts) {
  const [chatMode, setChatModeState] = useState<AgentMode>('auto-accept')
  const [modeChanging, setModeChanging] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getApi()
      .getMode(taskId, mode)
      .then((m) => { if (!cancelled) setChatModeState(m) })
      .catch(() => { /* keep default */ })
    return () => { cancelled = true }
  }, [taskId, mode])

  const handleModeChange = useCallback(async (next: AgentMode) => {
    if (next === chatMode || modeChanging) return
    setChatModeState(next)
    setModeChanging(true)
    try {
      await getApi().setMode({ tabId, taskId, mode, cwd, chatMode: next })
      toast(`Mode → ${next}`)
    } catch (err) {
      toast(`Mode change failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setModeChanging(false)
    }
  }, [chatMode, modeChanging, tabId, taskId, mode, cwd])

  return { chatMode, modeChanging, handleModeChange }
}
