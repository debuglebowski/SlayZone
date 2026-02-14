import posthog from 'posthog-js'
import type { TelemetryTier, TelemetryEventName, TelemetryEventProps } from '../shared/types'

declare const __POSTHOG_API_KEY__: string
declare const __POSTHOG_HOST__: string
declare const __DEV__: boolean
declare const __POSTHOG_DEV_ENABLED__: boolean

const POSTHOG_KEY = typeof __POSTHOG_API_KEY__ !== 'undefined' ? __POSTHOG_API_KEY__ : ''
const POSTHOG_HOST = typeof __POSTHOG_HOST__ !== 'undefined' ? __POSTHOG_HOST__ : ''
const IS_DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : true
const DEV_ENABLED = typeof __POSTHOG_DEV_ENABLED__ !== 'undefined' ? __POSTHOG_DEV_ENABLED__ : false
const ENABLED = POSTHOG_KEY && POSTHOG_HOST && (!IS_DEV || DEV_ENABLED)

let currentTier: TelemetryTier = 'anonymous'
let initialized = false

export function initTelemetry(tier: TelemetryTier): void {
  if (!ENABLED) return

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

  posthog.register({ environment: IS_DEV ? 'development' : 'production' })

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
