import { useState, useEffect, useCallback } from 'react'

export interface PanelSizes {
  browser: number
  gitDiff: number
  settings: number
}

const DEFAULT_SIZES: PanelSizes = {
  browser: 400,
  gitDiff: 520,
  settings: 320
}

const SETTINGS_KEY = 'taskDetailPanelSizes'

export function usePanelSizes(): [PanelSizes, (updates: Partial<PanelSizes>) => void] {
  const [sizes, setSizes] = useState<PanelSizes>(DEFAULT_SIZES)

  useEffect(() => {
    window.api.settings.get(SETTINGS_KEY).then((stored) => {
      if (stored) {
        try {
          setSizes({ ...DEFAULT_SIZES, ...JSON.parse(stored) })
        } catch {
          /* ignore parse errors */
        }
      }
    })
  }, [])

  const updateSizes = useCallback((updates: Partial<PanelSizes>) => {
    setSizes((prev) => {
      const next = { ...prev, ...updates }
      window.api.settings.set(SETTINGS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return [sizes, updateSizes]
}
