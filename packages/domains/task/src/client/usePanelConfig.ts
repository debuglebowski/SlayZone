import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PanelConfig, WebPanelDefinition } from '../shared/types'
import { DEFAULT_PANEL_CONFIG, PREDEFINED_WEB_PANELS } from '../shared/types'

const SETTINGS_KEY = 'panel_config'
const CHANGE_EVENT = 'panel-config-changed'

/** Merge predefined panels into stored config (adds new ones, syncs shortcuts, skips user-deleted) */
function mergePredefined(config: PanelConfig): PanelConfig {
  const existingIds = new Set(config.webPanels.map(wp => wp.id))
  const deleted = new Set(config.deletedPredefined ?? [])
  const missing = PREDEFINED_WEB_PANELS.filter(p => !existingIds.has(p.id) && !deleted.has(p.id))
  const predefinedMap = new Map(PREDEFINED_WEB_PANELS.map(p => [p.id, p]))
  // Sync shortcuts for existing predefined panels
  const synced = config.webPanels.map(wp => {
    const src = predefinedMap.get(wp.id)
    return src && wp.shortcut !== src.shortcut ? { ...wp, shortcut: src.shortcut } : wp
  })
  const changed = missing.length > 0 || synced.some((wp, i) => wp !== config.webPanels[i])
  if (!changed) return config
  return { ...config, webPanels: [...synced, ...missing] }
}

function loadConfig(): Promise<PanelConfig> {
  return window.api.settings.get(SETTINGS_KEY).then(raw => {
    if (raw) {
      try {
        return mergePredefined(JSON.parse(raw) as PanelConfig)
      } catch { /* ignore */ }
    }
    return DEFAULT_PANEL_CONFIG
  })
}

export function usePanelConfig(): {
  config: PanelConfig
  updateConfig: (next: PanelConfig) => Promise<void>
  enabledWebPanels: WebPanelDefinition[]
  isBuiltinEnabled: (id: string) => boolean
} {
  const [config, setConfig] = useState<PanelConfig>(DEFAULT_PANEL_CONFIG)

  useEffect(() => {
    void loadConfig().then(setConfig)

    const onChanged = () => { void loadConfig().then(setConfig) }
    window.addEventListener(CHANGE_EVENT, onChanged)
    return () => window.removeEventListener(CHANGE_EVENT, onChanged)
  }, [])

  const updateConfig = useCallback(async (next: PanelConfig) => {
    setConfig(next)
    await window.api.settings.set(SETTINGS_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  }, [])

  const enabledWebPanels = useMemo(
    () => config.webPanels.filter(wp => config.builtinEnabled[wp.id] !== false),
    [config]
  )

  const isBuiltinEnabled = useCallback(
    (id: string) => config.builtinEnabled[id] !== false,
    [config]
  )

  return { config, updateConfig, enabledWebPanels, isBuiltinEnabled }
}
