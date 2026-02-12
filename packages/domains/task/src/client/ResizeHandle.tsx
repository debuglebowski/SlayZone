import { useRef, useCallback } from 'react'

interface ResizeHandleProps {
  width: number
  minWidth: number
  onWidthChange: (width: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  onReset?: () => void
}

export function ResizeHandle({
  width,
  minWidth,
  onWidthChange,
  onDragStart,
  onDragEnd,
  onReset
}: ResizeHandleProps) {
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(width)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      startX.current = e.clientX
      startWidth.current = width
      onDragStart?.()

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return
        const delta = e.clientX - startX.current
        const newWidth = Math.max(minWidth, startWidth.current - delta)
        onWidthChange(newWidth)
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        onDragEnd?.()
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [width, minWidth, onWidthChange, onDragStart, onDragEnd]
  )

  return (
    <div
      data-testid="panel-resize-handle"
      className="w-4 shrink-0 cursor-col-resize flex items-center justify-center group z-10"
      onMouseDown={handleMouseDown}
      onDoubleClick={onReset}
    >
      <div className="w-1 h-8 rounded-full opacity-0 group-hover:opacity-100 group-active:opacity-100 bg-primary/30 group-active:bg-primary/50 transition-opacity" />
    </div>
  )
}
