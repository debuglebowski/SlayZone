import { createContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import posthog from 'posthog-js'
import { PostHogProvider } from '@posthog/react'
import type { TelemetryTier } from '../shared/types'
import { initTelemetry, setTelemetryTier as setTelemetryTierInternal, track, startHeartbeat, stopHeartbeat } from './telemetry'

const SETTINGS_KEY = 'telemetry_tier'

interface TelemetryContextValue {
  tier: TelemetryTier
  setTier: (tier: TelemetryTier) => void
  track: typeof track
}

export const TelemetryContext = createContext<TelemetryContextValue>({
  tier: 'anonymous',
  setTier: () => {},
  track
})

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<TelemetryTier>('anonymous')
  const [ready, setReady] = useState(false)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    window.api.settings.get(SETTINGS_KEY).then((stored) => {
      const t: TelemetryTier = stored === 'opted_in' ? 'opted_in' : 'anonymous'
      setTier(t)
      initTelemetry(t)
      startHeartbeat()
      setReady(true)

      window.api.app.getVersion().then((version) => {
        track('app_opened', { version })
      })
    })

    return () => stopHeartbeat()
  }, [])

  const changeTier = useCallback((newTier: TelemetryTier) => {
    setTier(newTier)
    setTelemetryTierInternal(newTier)
    window.api.settings.set(SETTINGS_KEY, newTier)
  }, [])

  return (
    <TelemetryContext.Provider value={{ tier, setTier: changeTier, track }}>
      {ready ? (
        <PostHogProvider client={posthog}>{children}</PostHogProvider>
      ) : (
        children
      )}
    </TelemetryContext.Provider>
  )
}
