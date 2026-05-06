import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  cn,
} from '@slayzone/ui'
import { useTabStore } from '@slayzone/settings'
import type { Task } from '@slayzone/task/shared'
import type { Project } from '@slayzone/projects/shared'
import type { OnboardingChecklistState } from '@/hooks/useOnboardingChecklist'
import { SidebarFooterIcons } from './SidebarFooterIcons'
import { SidebarViewSwitcher } from './SidebarViewSwitcher'
import { SidebarResizeHandle } from './SidebarResizeHandle'
import { getView } from './views/registry'

interface AppSidebarProps {
  projects: Project[]
  tasks: Task[]
  selectedProjectId: string
  onSelectProject: (id: string) => void
  onProjectSettings: (project: Project) => void
  onSettings: () => void
  onUsageAnalytics: () => void
  onLeaderboard: () => void
  onTaskClick?: (taskId: string) => void
  zenMode?: boolean
  onboardingChecklist: OnboardingChecklistState
  idleByProject?: Map<string, number>
  onReorderProjects: (projectIds: string[]) => void
}

export function AppSidebar({
  projects,
  tasks,
  selectedProjectId,
  onSelectProject,
  onProjectSettings,
  onSettings,
  onUsageAnalytics,
  onLeaderboard,
  onTaskClick,
  zenMode,
  onboardingChecklist,
  idleByProject,
  onReorderProjects,
}: AppSidebarProps) {
  const sidebarView = useTabStore((s) => s.sidebarView)
  const setSidebarView = useTabStore((s) => s.setSidebarView)
  const sidebarWidth = useTabStore((s) => s.sidebarWidth)
  const setSidebarWidth = useTabStore((s) => s.setSidebarWidth)
  const sidebarAutoHide = useTabStore((s) => s.sidebarAutoHide)
  const setSidebarAutoHide = useTabStore((s) => s.setSidebarAutoHide)
  const view = getView(sidebarView)

  const [hoverRevealed, setHoverRevealed] = useState(false)
  const [resizing, setResizing] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    cancelClose()
    const tick = () => {
      // Keep card open as long as a dropdown / context menu / popover is open
      // (Radix portals these to document.body so mouse leaves the card while
      // interacting with them).
      if (document.querySelector('[role="menu"], [role="dialog"]')) {
        closeTimerRef.current = setTimeout(tick, 200)
        return
      }
      setHoverRevealed(false)
      closeTimerRef.current = null
    }
    closeTimerRef.current = setTimeout(tick, 400)
  }, [cancelClose])

  useEffect(() => () => cancelClose(), [cancelClose])

  const compactSwitcher = view.footerLayout === 'vertical'
  const autoHideActive = sidebarAutoHide && !zenMode
  const isResizable = !zenMode && !!view.resizable
  const effectiveWidth =
    isResizable
      ? sidebarWidth ?? view.defaultWidth ?? 288
      : null

  const sidebarBody = (
    <Sidebar
      collapsible="none"
      style={effectiveWidth != null ? { width: effectiveWidth } : undefined}
      className={cn(
        'relative',
        zenMode && '!w-0 overflow-hidden',
        !zenMode && effectiveWidth == null && view.width,
        autoHideActive
          ? 'h-full rounded-xl overflow-hidden shadow-2xl border border-border'
          : 'h-svh'
      )}
    >
      <SidebarContent className={cn('pb-4 scrollbar-hide', autoHideActive ? 'pt-4' : 'pt-10')}>
        <SidebarGroup>
          <SidebarGroupContent>
            {view.render({
              projects,
              tasks,
              selectedProjectId,
              onSelectProject,
              onProjectSettings,
              onTaskClick,
              onReorderProjects,
              idleByProject,
            })}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="py-4 gap-3 border-t border-border/60">
        <SidebarFooterIcons
          layout={view.footerLayout}
          tasks={tasks}
          onTaskClick={onTaskClick}
          onSettings={onSettings}
          onUsageAnalytics={onUsageAnalytics}
          onLeaderboard={onLeaderboard}
          onboardingChecklist={onboardingChecklist}
        />
        <div className={cn('px-2 flex', compactSwitcher ? 'justify-center' : 'w-full')}>
          <SidebarViewSwitcher
            current={sidebarView}
            onChange={setSidebarView}
            compact={compactSwitcher}
            autoHide={sidebarAutoHide}
            onToggleAutoHide={() => setSidebarAutoHide(!sidebarAutoHide)}
          />
        </div>
      </SidebarFooter>
      {isResizable && effectiveWidth != null && (
        <SidebarResizeHandle
          currentWidth={effectiveWidth}
          minWidth={view.minWidth ?? 200}
          maxWidth={view.maxWidth ?? 600}
          defaultWidth={view.defaultWidth ?? 288}
          onChange={setSidebarWidth}
          onReset={() => setSidebarWidth(null)}
          onDragStateChange={setResizing}
        />
      )}
    </Sidebar>
  )

  if (autoHideActive) {
    return (
      <>
        {/* Zero-width height anchor so the parent flex row keeps its h-svh height
            (the floating sidebar below is `fixed` and contributes no flow height). */}
        <div className="h-svh w-0 shrink-0" aria-hidden />
        {/* Hover trigger strip on far left edge */}
        <div
          className="fixed inset-y-0 left-0 w-2 z-30"
          onMouseEnter={() => {
            cancelClose()
            setHoverRevealed(true)
          }}
        />
        {/* Floating card overlay (with right-edge spatial grace buffer) */}
        <div
          className={cn(
            'fixed top-10 bottom-2 left-2 z-40 transition-transform duration-200 ease-out pr-10',
            hoverRevealed
              ? 'translate-x-0'
              : '-translate-x-[calc(100%+0.5rem)] pointer-events-none'
          )}
          onMouseEnter={() => {
            cancelClose()
            setHoverRevealed(true)
          }}
          onMouseLeave={() => {
            if (!resizing) scheduleClose()
          }}
        >
          {sidebarBody}
        </div>
      </>
    )
  }

  return sidebarBody
}
