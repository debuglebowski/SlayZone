import { useRef, useCallback } from 'react'
import { Terminal } from '@slayzone/terminal/client/Terminal'
import type { TerminalMode } from '@slayzone/terminal/shared'

interface AgentSidePanelProps {
  width: number
  onWidthChange: (width: number) => void
  sessionId: string
  cwd: string
  mode: TerminalMode
  isActive: boolean
}

const MIN_WIDTH = 320
const MAX_WIDTH = 720

export function AgentSidePanel({
  width,
  onWidthChange,
  sessionId,
  cwd,
  mode,
  isActive
}: AgentSidePanelProps) {
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(width)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true
      startX.current = e.clientX
      startWidth.current = width

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return
        const delta = startX.current - e.clientX
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
        onWidthChange(newWidth)
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [width, onWidthChange]
  )

  return (
    <div className="relative h-full rounded-md bg-surface-1 border border-border overflow-hidden flex flex-col" style={{ width }}>
      <div
        className="absolute left-0 top-0 bottom-0 w-1 z-10 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
        onMouseDown={handleMouseDown}
      />
      <div className="flex items-center shrink-0 h-10 px-2 gap-1 border-b border-border bg-surface-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agent</span>
      </div>
      <div className="flex-1 min-h-0">
        <Terminal
          key={sessionId}
          sessionId={sessionId}
          cwd={cwd}
          mode={mode}
          isActive={isActive}
        />
      </div>
    </div>
  )
}
