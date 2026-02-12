import { useState, useEffect, useCallback, useRef } from 'react'
import type { PanelVisibility } from '../shared/types'

export type PanelSize = number | 'auto'

export interface PanelSizes {
  terminal: PanelSize
  browser: PanelSize
  diff: PanelSize
  settings: number
  editor: PanelSize
}

const DEFAULT_SIZES: PanelSizes = {
  terminal: 'auto',
  browser: 'auto',
  diff: 'auto',
  settings: 440,
  editor: 'auto'
}

const SETTINGS_KEY = 'taskDetailPanelSizes'
const HANDLE_WIDTH = 16 // w-4 = 1rem
// Bump when the storage schema changes to force migration
const STORAGE_VERSION = 3

const PANEL_ORDER: (keyof PanelVisibility)[] = ['terminal', 'browser', 'editor', 'diff', 'settings']

export function resolveWidths(
  sizes: PanelSizes,
  visibility: PanelVisibility,
  containerWidth: number
): Record<keyof PanelVisibility, number> {
  const visible = PANEL_ORDER.filter((p) => visibility[p])
  const handleCount = Math.max(0, visible.length - 1)
  const available = containerWidth - handleCount * HANDLE_WIDTH

  let fixedSum = 0
  let autoCount = 0
  for (const p of visible) {
    const s = sizes[p]
    if (s === 'auto') autoCount++
    else fixedSum += s
  }

  const autoWidth = autoCount > 0 ? Math.max(100, (available - fixedSum) / autoCount) : 0

  const result = {} as Record<keyof PanelVisibility, number>
  for (const p of visible) {
    result[p] = sizes[p] === 'auto' ? autoWidth : (sizes[p] as number)
  }
  return result
}

function persist(sizes: PanelSizes): void {
  window.api.settings.set(SETTINGS_KEY, JSON.stringify({ ...sizes, _v: STORAGE_VERSION }))
}

export function usePanelSizes(): [
  PanelSizes,
  (updates: Partial<PanelSizes>) => void,
  (panel: keyof PanelSizes) => void,
  () => void
] {
  const [sizes, setSizes] = useState<PanelSizes>(DEFAULT_SIZES)
  const loaded = useRef(false)

  useEffect(() => {
    window.api.settings.get(SETTINGS_KEY).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed._v === STORAGE_VERSION) {
            // Current format — use as-is
            const { _v, ...rest } = parsed
            setSizes({ ...DEFAULT_SIZES, ...rest })
          } else {
            // Old format — only keep settings width, reset everything else
            const migrated = { ...DEFAULT_SIZES, settings: parsed.settings ?? DEFAULT_SIZES.settings }
            setSizes(migrated)
            persist(migrated)
          }
        } catch {
          /* ignore parse errors */
        }
      }
      loaded.current = true
    })
  }, [])

  const updateSizes = useCallback((updates: Partial<PanelSizes>) => {
    setSizes((prev) => {
      const next = { ...prev, ...updates }
      if (loaded.current) persist(next)
      return next
    })
  }, [])

  const resetPanel = useCallback((panel: keyof PanelSizes) => {
    updateSizes({ [panel]: DEFAULT_SIZES[panel] })
  }, [updateSizes])

  const resetAll = useCallback(() => {
    updateSizes(DEFAULT_SIZES)
  }, [updateSizes])

  return [sizes, updateSizes, resetPanel, resetAll]
}
