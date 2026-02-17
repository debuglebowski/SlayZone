import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import type { Task } from '@slayzone/task/shared'
import type { Column } from './kanban'

export type PickerType = 'status' | 'priority'

export interface PickerState {
  type: PickerType
  taskId: string
}

interface UseKanbanKeyboardOptions {
  columns: Column[]
  isActive: boolean
  isDragging?: boolean
  onTaskClick?: (task: Task, e: { metaKey: boolean }) => void
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void
}

interface UseKanbanKeyboardReturn {
  focusedTaskId: string | null
  setFocusedTaskId: (id: string | null) => void
  pickerState: PickerState | null
  closePickerState: () => void
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
}

export function useKanbanKeyboard({
  columns,
  isActive,
  isDragging,
  onTaskClick,
  onUpdateTask
}: UseKanbanKeyboardOptions): UseKanbanKeyboardReturn {
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null)
  const [pickerState, setPickerState] = useState<PickerState | null>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  // Guard: Radix Popover handles Escape with flushSync, which can cause useHotkeys
  // to see pickerState=null mid-event and accidentally clear focus
  const pickerClosingRef = useRef(false)

  // Grid lookup: taskId → { col, row }
  const gridLookup = useMemo(() => {
    const map = new Map<string, { col: number; row: number }>()
    columns.forEach((col, ci) => {
      col.tasks.forEach((task, ri) => {
        map.set(task.id, { col: ci, row: ri })
      })
    })
    return map
  }, [columns])

  // Clear focus if focused task disappears (filtered/deleted)
  useEffect(() => {
    if (focusedTaskId && !gridLookup.has(focusedTaskId)) {
      setFocusedTaskId(null)
    }
  }, [focusedTaskId, gridLookup])

  // Close picker when focus changes
  useEffect(() => {
    setPickerState(null)
  }, [focusedTaskId])

  const findTask = useCallback(
    (id: string) => {
      for (const col of columns) {
        const t = col.tasks.find((t) => t.id === id)
        if (t) return t
      }
      return null
    },
    [columns]
  )

  const focusFirst = useCallback(() => {
    for (const col of columns) {
      if (col.tasks.length > 0) {
        setFocusedTaskId(col.tasks[0].id)
        cardRefs.current.get(col.tasks[0].id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        return
      }
    }
  }, [columns])

  const navigate = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!focusedTaskId) {
        focusFirst()
        return
      }
      const pos = gridLookup.get(focusedTaskId)
      if (!pos) {
        focusFirst()
        return
      }

      let nextCol = pos.col
      let nextRow = pos.row

      switch (direction) {
        case 'up':
          nextRow = Math.max(0, pos.row - 1)
          break
        case 'down':
          nextRow = Math.min(columns[pos.col].tasks.length - 1, pos.row + 1)
          break
        case 'left':
          for (let c = pos.col - 1; c >= 0; c--) {
            if (columns[c].tasks.length > 0) {
              nextCol = c
              break
            }
          }
          if (nextCol === pos.col) return // no non-empty column to the left
          nextRow = Math.min(pos.row, columns[nextCol].tasks.length - 1)
          break
        case 'right':
          for (let c = pos.col + 1; c < columns.length; c++) {
            if (columns[c].tasks.length > 0) {
              nextCol = c
              break
            }
          }
          if (nextCol === pos.col) return // no non-empty column to the right
          nextRow = Math.min(pos.row, columns[nextCol].tasks.length - 1)
          break
      }

      const target = columns[nextCol]?.tasks[nextRow]
      if (target) {
        setFocusedTaskId(target.id)
        cardRefs.current.get(target.id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    },
    [focusedTaskId, gridLookup, columns, focusFirst]
  )

  const enabled = isActive && !pickerState && !isDragging

  useHotkeys('j, ArrowDown', (e) => { e.preventDefault(); navigate('down') }, { enabled })
  useHotkeys('k, ArrowUp', (e) => { e.preventDefault(); navigate('up') }, { enabled })
  useHotkeys('h, ArrowLeft', (e) => { e.preventDefault(); navigate('left') }, { enabled })
  useHotkeys('l, ArrowRight', (e) => { e.preventDefault(); navigate('right') }, { enabled })

  useHotkeys('enter', (e) => {
    if (!focusedTaskId) return
    e.preventDefault()
    const task = findTask(focusedTaskId)
    if (task) onTaskClick?.(task, { metaKey: false })
  }, { enabled })

  useHotkeys('mod+enter', (e) => {
    if (!focusedTaskId) return
    e.preventDefault()
    const task = findTask(focusedTaskId)
    if (task) onTaskClick?.(task, { metaKey: true })
  }, { enabled })

  useHotkeys('s', (e) => {
    if (!focusedTaskId || !onUpdateTask) return
    e.preventDefault()
    setPickerState({ type: 'status', taskId: focusedTaskId })
  }, { enabled })

  useHotkeys('p', (e) => {
    if (!focusedTaskId || !onUpdateTask) return
    e.preventDefault()
    setPickerState({ type: 'priority', taskId: focusedTaskId })
  }, { enabled })

  useHotkeys('escape', (e) => {
    if (pickerState) {
      e.preventDefault()
      pickerClosingRef.current = true
      setPickerState(null)
      requestAnimationFrame(() => { pickerClosingRef.current = false })
    } else if (focusedTaskId && !pickerClosingRef.current) {
      e.preventDefault()
      setFocusedTaskId(null)
    }
  }, { enabled: isActive })

  return {
    focusedTaskId,
    setFocusedTaskId,
    pickerState,
    closePickerState: useCallback(() => {
      pickerClosingRef.current = true
      setPickerState(null)
      requestAnimationFrame(() => { pickerClosingRef.current = false })
    }, []),
    cardRefs
  }
}
