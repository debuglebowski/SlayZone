import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PanelConfig, WebPanelDefinition } from '../shared/types'
import { DEFAULT_PANEL_CONFIG } from '../shared/types'
import { mergePredefinedWebPanels } from '../shared/panel-config'

const SETTINGS_KEY = 'panel_config'
const CHANGE_EVENT = 'panel-config-changed'

function loadConfig(): Promise<PanelConfig> {
  return window.api.settings.get(SETTINGS_KEY).then(raw => {
    if (raw) {
      try {
        return mergePredefinedWebPanels(JSON.parse(raw) as PanelConfig)
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
