import { useState, useEffect, useCallback, useMemo } from 'react'
import type { TerminalTab, TerminalGroup } from '../shared/types'
import type { TerminalMode } from '@slayzone/terminal/shared'

interface UseTaskTerminalsResult {
  tabs: TerminalTab[]
  groups: TerminalGroup[]
  activeGroupId: string
  isLoading: boolean
  setActiveGroupId: (id: string) => void
  createTab: (mode?: TerminalMode) => Promise<TerminalTab>
  splitTab: (tabId: string) => Promise<TerminalTab | null>
  closeTab: (tabId: string) => Promise<boolean>
  movePane: (tabId: string, targetGroupId: string | null) => Promise<void>
  renameTab: (tabId: string, label: string | null) => Promise<void>
  getSessionId: (tabId: string) => string
}

function computeGroups(tabs: TerminalTab[]): TerminalGroup[] {
  const map = new Map<string, TerminalTab[]>()
  for (const tab of tabs) {
    const existing = map.get(tab.groupId)
    if (existing) {
      existing.push(tab)
    } else {
      map.set(tab.groupId, [tab])
    }
  }

  const groups: TerminalGroup[] = []
  for (const [id, groupTabs] of map) {
    groupTabs.sort((a, b) => a.position - b.position)
    groups.push({
      id,
      tabs: groupTabs,
      isMain: groupTabs.some(t => t.isMain)
    })
  }

  // Sort groups: main first, then by first tab's position
  groups.sort((a, b) => {
    if (a.isMain && !b.isMain) return -1
    if (!a.isMain && b.isMain) return 1
    return (a.tabs[0]?.position ?? 0) - (b.tabs[0]?.position ?? 0)
  })

  return groups
}

export function useTaskTerminals(taskId: string, defaultMode: TerminalMode): UseTaskTerminalsResult {
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string>(taskId) // Main group id = taskId
  const [isLoading, setIsLoading] = useState(true)

  const groups = useMemo(() => computeGroups(tabs), [tabs])

  // Load tabs on mount
  useEffect(() => {
    const loadTabs = async () => {
      setIsLoading(true)
      try {
        await window.api.tabs.ensureMain(taskId, defaultMode)
        const loadedTabs = await window.api.tabs.list(taskId)
        setTabs(loadedTabs)
        // Set active to main group if current active doesn't exist
        const loadedGroups = computeGroups(loadedTabs)
        if (!loadedGroups.find(g => g.id === activeGroupId)) {
          const mainGroup = loadedGroups.find(g => g.isMain)
          if (mainGroup) setActiveGroupId(mainGroup.id)
        }
      } catch (err) {
        console.error('[useTaskTerminals] Failed to load tabs:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadTabs()
  }, [taskId, defaultMode])

  // Create a new group with one terminal
  const createTab = useCallback(async (mode?: TerminalMode): Promise<TerminalTab> => {
    const newTab = await window.api.tabs.create({ taskId, mode: mode || 'terminal' })
    setTabs(prev => [...prev, newTab])
    setActiveGroupId(newTab.groupId)
    return newTab
  }, [taskId])

  // Split: add a new pane to the same group as the target tab
  const splitTab = useCallback(async (tabId: string): Promise<TerminalTab | null> => {
    const newTab = await window.api.tabs.split(tabId)
    if (newTab) {
      setTabs(prev => [...prev, newTab])
    }
    return newTab
  }, [])

  const closeTab = useCallback(async (tabId: string): Promise<boolean> => {
    const success = await window.api.tabs.delete(tabId)
    if (success) {
      const sessionId = `${taskId}:${tabId}`
      await window.api.pty.kill(sessionId)

      setTabs(prev => {
        const remaining = prev.filter(t => t.id !== tabId)
        // If the closed tab's group is now empty, we'll handle group switching below
        return remaining
      })

      // Check if we need to switch active group
      setActiveGroupId(prev => {
        // Recompute from the updated tabs to see if the group still exists
        // We use functional updater on tabs to peek at current state
        return prev // Will be corrected in the effect below if needed
      })
    }
    return success
  }, [taskId])

  // Correct activeGroupId if the active group no longer exists
  useEffect(() => {
    if (isLoading) return
    const activeGroup = groups.find(g => g.id === activeGroupId)
    if (!activeGroup && groups.length > 0) {
      const mainGroup = groups.find(g => g.isMain)
      setActiveGroupId(mainGroup?.id ?? groups[0].id)
    }
  }, [groups, activeGroupId, isLoading])

  // Move a pane to a different group (null = new standalone group)
  const movePane = useCallback(async (tabId: string, targetGroupId: string | null): Promise<void> => {
    const updated = await window.api.tabs.moveToGroup(tabId, targetGroupId)
    if (updated) {
      setTabs(prev => prev.map(t => t.id === tabId ? updated : t))
    }
  }, [])

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
    groups,
    activeGroupId,
    isLoading,
    setActiveGroupId,
    createTab,
    splitTab,
    closeTab,
    movePane,
    renameTab,
    getSessionId
  }
}
