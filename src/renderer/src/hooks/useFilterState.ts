import { useState, useEffect, useRef, useCallback } from 'react'
import { FilterState, defaultFilterState } from '@/components/filters/FilterState'

function getFilterKey(projectId: string | null): string {
  return projectId ? `filter:${projectId}` : 'filter:all'
}

export function useFilterState(
  projectId: string | null
): [FilterState, (filter: FilterState) => void, boolean] {
  const [filterState, setFilterState] = useState<FilterState>(defaultFilterState)
  const [isLoaded, setIsLoaded] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevProjectIdRef = useRef<string | null>(projectId)

  // Load filter from settings on mount and when projectId changes
  useEffect(() => {
    const key = getFilterKey(projectId)

    // Only reset loaded state if projectId actually changed
    if (prevProjectIdRef.current !== projectId) {
      setIsLoaded(false)
      prevProjectIdRef.current = projectId
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
      setIsLoaded(true)
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

  return [filterState, setFilter, isLoaded]
}
