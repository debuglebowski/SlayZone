import { useCallback, useEffect, useState } from 'react'
import { toast, type AgentModel, type ResolvedAgentModel } from '@slayzone/ui'

interface SessionInfoLite {
  chatModel?: AgentModel | null
}

interface UseChatModelOpts {
  taskId: string
  mode: string
  tabId: string
  cwd: string
}

interface ChatModelApi {
  setModel: (opts: { tabId: string; taskId: string; mode: string; cwd: string; chatModel: AgentModel }) => Promise<SessionInfoLite>
  getModel: (taskId: string, mode: string) => Promise<AgentModel>
  getInfo: (tabId: string) => Promise<SessionInfoLite | null>
  getAccountDefaultModel?: () => Promise<ResolvedAgentModel>
}

function getApi(): ChatModelApi {
  return (window as unknown as { api: { chat: ChatModelApi } }).api.chat
}

/**
 * Owns chat-model state. Mirrors useChatMode: server-authoritative, hydrate
 * from live session > DB cache, kill+respawn on change so the new flag set
 * takes effect.
 */
export function useChatModel({ taskId, mode, tabId, cwd }: UseChatModelOpts) {
  const [chatModel, setChatModelState] = useState<AgentModel>('default')
  const [modelChanging, setModelChanging] = useState(false)
  const [accountDefaultModel, setAccountDefaultModel] = useState<ResolvedAgentModel | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const info = await getApi().getInfo(tabId)
        if (cancelled) return
        if (info?.chatModel) {
          setChatModelState(info.chatModel)
          return
        }
        const cached = await getApi().getModel(taskId, mode)
        if (!cancelled) setChatModelState(cached)
      } catch {
        /* keep default */
      }
    })()
    return () => { cancelled = true }
  }, [taskId, mode, tabId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const fn = getApi().getAccountDefaultModel
        if (!fn) return
        const resolved = await fn()
        if (!cancelled) setAccountDefaultModel(resolved)
      } catch {
        /* leave null — pill omits hint */
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleModelChange = useCallback(async (next: AgentModel) => {
    if (next === chatModel || modelChanging) return
    setModelChanging(true)
    try {
      const info = await getApi().setModel({ tabId, taskId, mode, cwd, chatModel: next })
      if (info?.chatModel) setChatModelState(info.chatModel)
      else setChatModelState(next)
    } catch (err) {
      toast(`Model change failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setModelChanging(false)
    }
  }, [chatModel, modelChanging, tabId, taskId, mode, cwd])

  return { chatModel, modelChanging, handleModelChange, accountDefaultModel }
}
