import { useState, useEffect, useRef, useCallback } from 'react'
import { type FilterState, defaultFilterState } from './FilterState'

function getFilterKey(projectId: string | null): string {
  return projectId ? `filter:${projectId}` : 'filter:all'
}

export function useFilterState(
  projectId: string | null
): [FilterState, (filter: FilterState) => void] {
  const [filterState, setFilterState] = useState<FilterState>(defaultFilterState)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevProjectIdRef = useRef<string | null>(projectId)

  // Load filter from settings on mount and when projectId changes
  useEffect(() => {
    const key = getFilterKey(projectId)

    // Only reset loaded state if projectId actually changed
    if (prevProjectIdRef.current !== projectId) {
      // Set default filter immediately to prevent flicker
      setFilterState(defaultFilterState)
      prevProjectIdRef.current = projectId
      // Don't set isLoaded to false - keep showing the filter bar with default state
    }

    window.api.settings.get(key).then((value) => {
      if (value) {
        try {
          const parsed = JSON.parse(value) as FilterState
          setFilterState(parsed)
        } catch {
          setFilterState(defaultFilterState)
        }
      } else {
        setFilterState(defaultFilterState)
      }
    })
  }, [projectId])

  // Debounced save
  const setFilter = useCallback(
    (newFilter: FilterState) => {
      setFilterState(newFilter)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        const key = getFilterKey(projectId)
        window.api.settings.set(key, JSON.stringify(newFilter))
      }, 500)
    },
    [projectId]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return [filterState, setFilter]
}
