import posthog from 'posthog-js'
import type { TelemetryTier, TelemetryEventName, TelemetryEventProps } from '../shared/types'

const POSTHOG_KEY = '__POSTHOG_API_KEY__'
const POSTHOG_HOST = 'https://us.i.posthog.com'

let currentTier: TelemetryTier = 'anonymous'
let initialized = false

export function initTelemetry(tier: TelemetryTier): void {
  if (initialized) {
    posthog.reset()
  }

  currentTier = tier

  const isOptedIn = tier === 'opted_in'

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    persistence: isOptedIn ? 'localStorage+cookie' : 'memory',
    person_profiles: 'identified_only',
    capture_pageview: false,
    autocapture: false,
    disable_session_recording: true,
    ...(isOptedIn ? {} : { disable_persistence: true })
  })

  if (isOptedIn) {
    // Use persistent ID from settings, or let PostHog generate one
    const storedId = localStorage.getItem('slayzone_telemetry_id')
    if (storedId) {
      posthog.identify(storedId)
    } else {
      const id = crypto.randomUUID()
      localStorage.setItem('slayzone_telemetry_id', id)
      posthog.identify(id)
    }
  }

  initialized = true
}

export function track<E extends TelemetryEventName>(
  event: E,
  ...args: TelemetryEventProps[E] extends Record<string, never> ? [] : [TelemetryEventProps[E]]
): void {
  if (!initialized) return
  posthog.capture(event, args[0] as Record<string, unknown> | undefined)
}

export function setTelemetryTier(tier: TelemetryTier): void {
  if (tier === currentTier) return

  if (tier === 'anonymous') {
    posthog.reset()
    localStorage.removeItem('slayzone_telemetry_id')
  }

  initTelemetry(tier)
}

export function getTelemetryTier(): TelemetryTier {
  return currentTier
}

export function shutdownTelemetry(): void {
  if (initialized) {
    posthog.reset()
    initialized = false
  }
}
