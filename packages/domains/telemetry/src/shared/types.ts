export type TelemetryTier = 'anonymous' | 'opted_in'

export type TelemetryEventName =
  | 'app_opened'
  | 'heartbeat'
  | 'app_backgrounded'
  | 'onboarding_step'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | '$pageview'
  | 'panel_toggled'

export interface TelemetryEventProps {
  app_opened: { version: string }
  heartbeat: {
    active_ms: number
    active_minutes: number
  }
  app_backgrounded: {
    reason: 'backgrounded' | 'shutdown'
    active_ms: number
    active_minutes: number
  }
  onboarding_step: { step: number; step_name: string }
  onboarding_completed: { provider: string; tier: string }
  onboarding_skipped: { from_step: number; from_step_name: string }
  $pageview: { $current_url: string; page: 'home' | 'task' | 'leaderboard'; task_id?: string }
  panel_toggled: { panel: string; active: boolean; context: 'task' | 'home' }
}
