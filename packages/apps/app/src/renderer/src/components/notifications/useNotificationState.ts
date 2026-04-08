import { useState, useEffect, useCallback } from 'react'

export interface NotificationState {
  isLocked: boolean
  filterCurrentProject: boolean
  panelWidth: number
  desktopEnabled: boolean
}

export const DEFAULT_NOTIFICATION_PANEL_WIDTH = 320

const DEFAULT_STATE: NotificationState = {
  isLocked: false,
  filterCurrentProject: false,
  panelWidth: DEFAULT_NOTIFICATION_PANEL_WIDTH,
  desktopEnabled: false
}

const SETTINGS_KEY = 'notificationPanelState'

export function useNotificationState(): [
  NotificationState,
  (updates: Partial<NotificationState>) => void
] {
  const [state, setState] = useState<NotificationState>(DEFAULT_STATE)

  // Load from settings API on mount
  useEffect(() => {
    window.api.settings.get(SETTINGS_KEY).then((stored) => {
      if (stored) {
        try {
          setState({ ...DEFAULT_STATE, ...JSON.parse(stored) })
        } catch {
          // ignore parse errors
        }
      }
    })
  }, [])

  const updateState = useCallback((updates: Partial<NotificationState>) => {
    setState((prev) => {
      const next = { ...prev, ...updates }
      window.api.settings.set(SETTINGS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return [state, updateState]
}
