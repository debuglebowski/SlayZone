export type TelemetryTier = 'anonymous' | 'opted_in'

export type TelemetryEventName =
  | 'app_opened'
  | 'heartbeat'

export interface TelemetryEventProps {
  app_opened: { version: string }
  heartbeat: Record<string, never>
}
