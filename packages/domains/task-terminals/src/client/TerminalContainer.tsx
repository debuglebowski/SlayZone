import { useEffect, useCallback, useRef } from 'react'
import { Terminal, usePty } from '@slayzone/terminal'
import type { TerminalMode, CodeMode } from '@slayzone/terminal/shared'
import { useTaskTerminals } from './useTaskTerminals'
import { TerminalTabBar } from './TerminalTabBar'

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
    activeTabId,
    isLoading,
    setActiveTabId,
    createTab,
    closeTab,
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

  // Get active tab
  const activeTab = tabs.find(t => t.id === activeTabId)
  const activeSessionId = activeTab ? getSessionId(activeTab.id) : null

  // Notify parent when main tab active state changes
  useEffect(() => {
    onMainTabActiveChange?.(activeTab?.isMain ?? false)
  }, [activeTab?.isMain, onMainTabActiveChange])

  // Forward main tab state changes to task-level callbacks
  // (This is where the "main tab affects task" logic lives)
  useEffect(() => {
    const mainTab = tabs.find(t => t.isMain)
    if (!mainTab) return
    const mainSessionId = getSessionId(mainTab.id)
    // Subscribe to main tab prompt events for task-level notifications
    return subscribePrompt(mainSessionId, () => {
      // Main tab prompt events could trigger task-level UI updates
      // This is handled by the parent via onSessionInvalid, etc.
    })
  }, [taskId, tabs, getSessionId, subscribePrompt])

  // Keyboard shortcuts (only when this container's task tab is active)
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+T: New tab
      if (e.metaKey && e.key === 't' && !e.shiftKey) {
        e.preventDefault()
        createTab()
      }
      // Cmd+W: Close tab (unless main)
      if (e.metaKey && e.key === 'w' && !e.shiftKey && activeTab && !activeTab.isMain) {
        e.preventDefault()
        closeTab(activeTab.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, tabs, activeTabId, activeTab, createTab, closeTab, setActiveTabId])

  // Handle terminal ready - pass up to parent (active tab's API)
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
    if (activeTab?.isMain) {
      onConversationCreated?.(convId)
    }
  }, [activeTab, onConversationCreated])

  if (isLoading || !activeTab || !activeSessionId) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-[#0a0a0a]">
        <div className="text-neutral-500 text-sm">Loading terminal...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <TerminalTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabCreate={() => createTab()}
        onTabClose={closeTab}
        onTabRename={renameTab}
        rightContent={rightContent}
      />
      <div className="flex-1 min-h-0">
        <Terminal
          key={activeSessionId}
          sessionId={activeSessionId}
          cwd={cwd}
          mode={activeTab.mode}
          conversationId={activeTab.isMain ? conversationId : undefined}
          existingConversationId={activeTab.isMain ? existingConversationId : undefined}
          initialPrompt={activeTab.isMain ? initialPrompt : undefined}
          codeMode={activeTab.isMain ? codeMode : undefined}
          providerFlags={activeTab.isMain ? providerFlags : undefined}
          autoFocus={autoFocus}
          onConversationCreated={handleConversationCreated}
          onSessionInvalid={activeTab.isMain ? onSessionInvalid : undefined}
          onReady={handleTerminalReady}
          onFirstInput={onFirstInput}
        />
      </div>
    </div>
  )
}
