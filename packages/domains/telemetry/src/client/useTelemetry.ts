import { useState, useEffect, useCallback, useRef } from 'react'
import type { TelemetryTier } from '../shared/types'
import { initTelemetry, setTelemetryTier, track, shutdownTelemetry } from './telemetry'

const SETTINGS_KEY = 'telemetry_tier'

export function useTelemetry() {
  const [tier, setTier] = useState<TelemetryTier>('anonymous')
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    window.api.settings.get(SETTINGS_KEY).then((stored) => {
      const t: TelemetryTier = stored === 'opted_in' ? 'opted_in' : 'anonymous'
      setTier(t)
      initTelemetry(t)

      window.api.app.getVersion().then((version) => {
        track('app_opened', { version })
      })
    })

    return () => {
      shutdownTelemetry()
    }
  }, [])

  const changeTier = useCallback((newTier: TelemetryTier) => {
    setTier(newTier)
    setTelemetryTier(newTier)
    window.api.settings.set(SETTINGS_KEY, newTier)
  }, [])

  return { track, tier, setTier: changeTier }
}
