import { useState, useEffect, useCallback } from 'react'

export interface AgentPanelState {
  isOpen: boolean
  panelWidth: number
}

const DEFAULT_STATE: AgentPanelState = {
  isOpen: false,
  panelWidth: 400
}

const SETTINGS_KEY = 'agentPanelState'

export function useAgentPanelState(): [
  AgentPanelState,
  (updates: Partial<AgentPanelState>) => void
] {
  const [state, setState] = useState<AgentPanelState>(DEFAULT_STATE)

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

  const updateState = useCallback((updates: Partial<AgentPanelState>) => {
    setState((prev) => {
      const next = { ...prev, ...updates }
      window.api.settings.set(SETTINGS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return [state, updateState]
}
