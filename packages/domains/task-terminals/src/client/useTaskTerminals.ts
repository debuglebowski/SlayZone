import { useState, useEffect, useCallback } from 'react'
import type { TerminalTab } from '../shared/types'
import type { TerminalMode } from '@omgslayzone/terminal/shared'

interface UseTaskTerminalsResult {
  tabs: TerminalTab[]
  activeTabId: string
  isLoading: boolean
  setActiveTabId: (id: string) => void
  createTab: (mode?: TerminalMode) => Promise<TerminalTab>
  closeTab: (tabId: string) => Promise<boolean>
  renameTab: (tabId: string, label: string | null) => Promise<void>
  getSessionId: (tabId: string) => string
}

export function useTaskTerminals(taskId: string, defaultMode: TerminalMode): UseTaskTerminalsResult {
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>(taskId) // Main tab id = taskId
  const [isLoading, setIsLoading] = useState(true)

  // Load tabs on mount
  useEffect(() => {
    const loadTabs = async () => {
      setIsLoading(true)
      // Ensure main tab exists
      await window.api.tabs.ensureMain(taskId, defaultMode)
      // Load all tabs
      const loadedTabs = await window.api.tabs.list(taskId)
      setTabs(loadedTabs)
      // Set active to main tab if current active doesn't exist
      if (!loadedTabs.find(t => t.id === activeTabId)) {
        const mainTab = loadedTabs.find(t => t.isMain)
        if (mainTab) setActiveTabId(mainTab.id)
      }
      setIsLoading(false)
    }
    loadTabs()
  }, [taskId, defaultMode])

  const createTab = useCallback(async (mode?: TerminalMode): Promise<TerminalTab> => {
    const newTab = await window.api.tabs.create({ taskId, mode: mode || 'terminal' })
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)
    return newTab
  }, [taskId])

  const closeTab = useCallback(async (tabId: string): Promise<boolean> => {
    const tab = tabs.find(t => t.id === tabId)
    if (!tab || tab.isMain) return false

    const success = await window.api.tabs.delete(tabId)
    if (success) {
      // Kill PTY for this tab
      const sessionId = `${taskId}:${tabId}`
      await window.api.pty.kill(sessionId)

      setTabs(prev => prev.filter(t => t.id !== tabId))
      // If closing active tab, switch to main tab
      if (activeTabId === tabId) {
        const mainTab = tabs.find(t => t.isMain)
        if (mainTab) setActiveTabId(mainTab.id)
      }
    }
    return success
  }, [taskId, tabs, activeTabId])

  const renameTab = useCallback(async (tabId: string, label: string | null): Promise<void> => {
    const updated = await window.api.tabs.update({ id: tabId, label })
    if (updated) {
      setTabs(prev => prev.map(t => t.id === tabId ? updated : t))
    }
  }, [])

  const getSessionId = useCallback((tabId: string): string => {
    return `${taskId}:${tabId}`
  }, [taskId])

  return {
    tabs,
    activeTabId,
    isLoading,
    setActiveTabId,
    createTab,
    closeTab,
    renameTab,
    getSessionId
  }
}
