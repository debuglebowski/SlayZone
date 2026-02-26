import type { PanelConfig } from './types'
import { PREDEFINED_WEB_PANELS } from './types'
import { inferHostScopeFromUrl, inferProtocolFromUrl } from './handoff'

/** Merge predefined panels into stored config (adds missing, syncs defaults, skips user-deleted). */
export function mergePredefinedWebPanels(config: PanelConfig): PanelConfig {
  const existingIds = new Set(config.webPanels.map((wp) => wp.id))
  const deleted = new Set(config.deletedPredefined ?? [])
  const missing = PREDEFINED_WEB_PANELS.filter((panel) => !existingIds.has(panel.id) && !deleted.has(panel.id))
  const predefinedMap = new Map(PREDEFINED_WEB_PANELS.map((panel) => [panel.id, panel]))

  const synced = config.webPanels.map((panel) => {
    const predefined = predefinedMap.get(panel.id)
    const withShortcut =
      predefined && panel.shortcut !== predefined.shortcut ? { ...panel, shortcut: predefined.shortcut } : panel

    let migrated = withShortcut
    if (migrated.blockDesktopHandoff === undefined && predefined?.blockDesktopHandoff !== undefined) {
      migrated = { ...migrated, blockDesktopHandoff: predefined.blockDesktopHandoff }
    }

    if (migrated.handoffProtocol === undefined && predefined?.handoffProtocol !== undefined) {
      migrated = { ...migrated, handoffProtocol: predefined.handoffProtocol }
    } else if (migrated.handoffProtocol === undefined && migrated.blockDesktopHandoff === true) {
      const inferredProtocol = inferProtocolFromUrl(migrated.baseUrl)
      if (inferredProtocol) migrated = { ...migrated, handoffProtocol: inferredProtocol }
    }

    if (migrated.handoffHostScope === undefined && migrated.blockDesktopHandoff === true) {
      const inferredHostScope = inferHostScopeFromUrl(migrated.baseUrl)
      if (inferredHostScope) migrated = { ...migrated, handoffHostScope: inferredHostScope }
      else if (predefined?.handoffHostScope !== undefined) migrated = { ...migrated, handoffHostScope: predefined.handoffHostScope }
    }

    return migrated
  })

  const changed = missing.length > 0 || synced.some((panel, i) => panel !== config.webPanels[i])
  if (!changed) return config

  return { ...config, webPanels: [...synced, ...missing] }
}
