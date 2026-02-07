import { useState, useEffect, useRef, useCallback, type SetStateAction, type Dispatch } from 'react'
import type { TaskStatus } from '@slayzone/task/shared'

// Tab type (matches TabBar.tsx in app)
export type Tab = { type: 'home' } | { type: 'task'; taskId: string; title: string; status?: TaskStatus }

interface ViewState {
  tabs: Tab[]
  activeTabIndex: number
  selectedProjectId: string | null
}

const defaultViewState: ViewState = {
  tabs: [{ type: 'home' }],
  activeTabIndex: 0,
  selectedProjectId: null
}

export function useViewState(): [
  Tab[],
  number,
  string | null,
  Dispatch<SetStateAction<Tab[]>>,
  Dispatch<SetStateAction<number>>,
  Dispatch<SetStateAction<string | null>>
] {
  const [tabs, setTabsInternal] = useState<Tab[]>(defaultViewState.tabs)
  const [activeTabIndex, setActiveTabIndexInternal] = useState(defaultViewState.activeTabIndex)
  const [selectedProjectId, setSelectedProjectIdInternal] = useState<string | null>(
    defaultViewState.selectedProjectId
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLoadedRef = useRef(false)

  // Load from settings on mount
  useEffect(() => {
    window.api.settings.get('viewState').then((value) => {
      if (value) {
        try {
          const parsed = JSON.parse(value) as ViewState
          // Validate tabs structure
          if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
            if (parsed.tabs[0]?.type !== 'home') {
              parsed.tabs.unshift({ type: 'home' })
            }
            setTabsInternal(parsed.tabs)
            const clampedIndex = Math.max(
              0,
              Math.min(parsed.activeTabIndex ?? 0, parsed.tabs.length - 1)
            )
            setActiveTabIndexInternal(clampedIndex)
          }
          // Load selectedProjectId
          if (parsed.selectedProjectId !== undefined) {
            setSelectedProjectIdInternal(parsed.selectedProjectId)
          }
        } catch {
          // Invalid JSON, use defaults
        }
      }
      isLoadedRef.current = true
    })
  }, [])

  // Debounced save
  const save = useCallback(
    (newTabs: Tab[], newIndex: number, newProjectId: string | null) => {
      if (!isLoadedRef.current) return

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        const state: ViewState = {
          tabs: newTabs,
          activeTabIndex: newIndex,
          selectedProjectId: newProjectId
        }
        window.api.settings.set('viewState', JSON.stringify(state))
      }, 500)
    },
    []
  )

  // Helper to trigger save with current state
  const triggerSave = useCallback(() => {
    setTabsInternal((t) => {
      setActiveTabIndexInternal((i) => {
        setSelectedProjectIdInternal((p) => {
          save(t, i, p)
          return p
        })
        return i
      })
      return t
    })
  }, [save])

  const setTabs = useCallback(
    (newTabs: SetStateAction<Tab[]>) => {
      setTabsInternal((prev) => {
        const resolved = typeof newTabs === 'function' ? newTabs(prev) : newTabs
        setTimeout(triggerSave, 0)
        return resolved
      })
    },
    [triggerSave]
  )

  const setActiveTabIndex = useCallback(
    (newIndex: SetStateAction<number>) => {
      setActiveTabIndexInternal((prev) => {
        const resolved = typeof newIndex === 'function' ? newIndex(prev) : newIndex
        setTimeout(triggerSave, 0)
        return resolved
      })
    },
    [triggerSave]
  )

  const setSelectedProjectId = useCallback(
    (newId: SetStateAction<string | null>) => {
      setSelectedProjectIdInternal((prev) => {
        const resolved = typeof newId === 'function' ? newId(prev) : newId
        setTimeout(triggerSave, 0)
        return resolved
      })
    },
    [triggerSave]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return [tabs, activeTabIndex, selectedProjectId, setTabs, setActiveTabIndex, setSelectedProjectId]
}
