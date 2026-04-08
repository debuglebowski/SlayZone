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
    <div className="flex h-full border-l bg-background" style={{ width }}>
      <div
        className="w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
        onMouseDown={handleMouseDown}
      />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="flex items-center h-11 px-3 bg-sidebar window-drag-region">
          <span className="text-sm font-medium text-muted-foreground">Agent</span>
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
    </div>
  )
}
