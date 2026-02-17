import { Label } from '@slayzone/ui'
import { Switch } from '@slayzone/ui'
import type { TelemetryTier } from '../shared/types'

interface TelemetrySettingsProps {
  tier: TelemetryTier
  onTierChange: (tier: TelemetryTier) => void
}

export function TelemetrySettings({ tier, onTierChange }: TelemetrySettingsProps) {
  const isOptedIn = tier === 'opted_in'

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-base font-semibold">Anonymous Analytics</Label>
        <p className="text-sm text-muted-foreground">
          SlayZone records when the app is opened and sends an activity heartbeat every 5 minutes
          while you're active. No personal identifiers, no data stored on your device, no IP
          recording.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-semibold">Enhanced Analytics</Label>
        <p className="text-sm text-muted-foreground">
          Opt in to help us understand retention patterns over time. A random anonymous ID is
          persisted locally. No personal information is collected.
        </p>
        <div className="flex items-center gap-3">
          <Switch
            id="telemetry-opt-in"
            checked={isOptedIn}
            onCheckedChange={(checked: boolean) => onTierChange(checked ? 'opted_in' : 'anonymous')}
          />
          <label htmlFor="telemetry-opt-in" className="text-sm cursor-pointer">
            Help improve SlayZone
          </label>
        </div>
      </div>
    </div>
  )
}
