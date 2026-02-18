import { useEffect, useCallback, useRef, useMemo } from 'react'
import { usePty } from '@slayzone/terminal'
import type { TerminalMode, CodeMode } from '@slayzone/terminal/shared'
import { useTaskTerminals } from './useTaskTerminals'
import { TerminalTabBar } from './TerminalTabBar'
import { TerminalSplitGroup } from './TerminalSplitGroup'

interface TerminalContainerProps {
  taskId: string
  cwd: string
  defaultMode: TerminalMode
  conversationId?: string | null
  existingConversationId?: string | null
  initialPrompt?: string | null
  codeMode?: CodeMode | null
  providerFlags?: string
  isActive?: boolean
  autoFocus?: boolean
  onConversationCreated?: (conversationId: string) => void
  onSessionInvalid?: () => void
  onReady?: (api: {
    sendInput: (text: string) => Promise<void>
    write: (data: string) => Promise<boolean>
    focus: () => void
    clearBuffer: () => Promise<void>
  }) => void
  onFirstInput?: () => void
  onMainTabActiveChange?: (isMainActive: boolean) => void
  rightContent?: React.ReactNode
}

export function TerminalContainer({
  taskId,
  cwd,
  defaultMode,
  conversationId,
  existingConversationId,
  initialPrompt,
  codeMode,
  providerFlags,
  isActive = true,
  autoFocus = false,
  onConversationCreated,
  onSessionInvalid,
  onReady,
  onFirstInput,
  onMainTabActiveChange,
  rightContent
}: TerminalContainerProps) {
  const {
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
  } = useTaskTerminals(taskId, defaultMode)

  const { subscribePrompt } = usePty()
  const terminalApiRef = useRef<{
    sendInput: (text: string) => Promise<void>
    write: (data: string) => Promise<boolean>
    focus: () => void
    clearBuffer: () => Promise<void>
  } | null>(null)

  // Get active group
  const activeGroup = groups.find(g => g.id === activeGroupId)

  // Notify parent when main tab active state changes
  useEffect(() => {
    onMainTabActiveChange?.(activeGroup?.isMain ?? false)
  }, [activeGroup?.isMain, onMainTabActiveChange])

  // Forward main tab state changes to task-level callbacks
  useEffect(() => {
    const mainTab = tabs.find(t => t.isMain)
    if (!mainTab) return
    const mainSessionId = getSessionId(mainTab.id)
    return subscribePrompt(mainSessionId, () => {
      // Main tab prompt events could trigger task-level UI updates
    })
  }, [taskId, tabs, getSessionId, subscribePrompt])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+T: New group
      if (e.metaKey && e.key === 't' && !e.shiftKey) {
        e.preventDefault()
        createTab()
      }
      // Cmd+D: Split current group
      if (e.metaKey && e.key === 'd' && !e.shiftKey && activeGroup) {
        e.preventDefault()
        // Split the last pane in the active group
        const lastPane = activeGroup.tabs[activeGroup.tabs.length - 1]
        if (lastPane) splitTab(lastPane.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, activeGroup, createTab, splitTab])

  // Handle terminal ready - pass up to parent (main tab's API)
  const handleTerminalReady = useCallback((api: {
    sendInput: (text: string) => Promise<void>
    write: (data: string) => Promise<boolean>
    focus: () => void
    clearBuffer: () => Promise<void>
  }) => {
    terminalApiRef.current = api
    onReady?.(api)
  }, [onReady])

  // Handle conversation created - only for main tab
  const handleConversationCreated = useCallback((convId: string) => {
    onConversationCreated?.(convId)
  }, [onConversationCreated])

  // Split the active group — add a new pane
  const handleSplitGroup = useCallback((groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const lastPane = group.tabs[group.tabs.length - 1]
    if (lastPane) splitTab(lastPane.id)
  }, [groups, splitTab])

  // Close an entire group (all its panes)
  const closeGroup = useCallback(async (groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    if (!group || group.isMain) return
    // Close all tabs in the group
    for (const tab of [...group.tabs].reverse()) {
      await closeTab(tab.id)
    }
  }, [groups, closeTab])

  // Build pane props for the active group
  const paneProps = useMemo(() => {
    if (!activeGroup) return []
    return activeGroup.tabs.map(tab => ({
      tab,
      sessionId: getSessionId(tab.id),
      cwd,
      conversationId: tab.isMain ? conversationId : undefined,
      existingConversationId: tab.isMain ? existingConversationId : undefined,
      initialPrompt: tab.isMain ? initialPrompt : undefined,
      codeMode: tab.isMain ? codeMode : undefined,
      providerFlags: tab.isMain ? providerFlags : undefined,
      autoFocus,
      onConversationCreated: tab.isMain ? handleConversationCreated : undefined,
      onSessionInvalid: tab.isMain ? onSessionInvalid : undefined,
      onReady: tab.isMain ? handleTerminalReady : undefined,
      onFirstInput: tab.isMain ? onFirstInput : undefined
    }))
  }, [activeGroup, getSessionId, cwd, conversationId, existingConversationId, initialPrompt, codeMode, providerFlags, autoFocus, handleConversationCreated, onSessionInvalid, handleTerminalReady, onFirstInput])

  if (isLoading || !activeGroup) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-[#0a0a0a]">
        <div className="text-neutral-500 text-sm">Loading terminal...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <TerminalTabBar
        groups={groups}
        activeGroupId={activeGroupId}
        onGroupSelect={setActiveGroupId}
        onGroupCreate={() => createTab()}
        onGroupClose={closeGroup}
        onGroupSplit={handleSplitGroup}
        onPaneClose={closeTab}
        onPaneMove={movePane}
        onGroupRename={renameTab}
        rightContent={rightContent}
      />
      <div className="flex-1 min-h-0">
        <TerminalSplitGroup
          key={activeGroupId}
          panes={paneProps}
        />
      </div>
    </div>
  )
}
