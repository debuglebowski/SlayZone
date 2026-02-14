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
          SlayZone collects anonymous usage counts (e.g. features used, app opened) with no
          personal identifiers. No data is stored on your device and your IP address is not
          recorded.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-semibold">Enhanced Analytics</Label>
        <p className="text-sm text-muted-foreground">
          Opt in to help us understand usage patterns over time — like retention and feature
          adoption. A random anonymous ID is persisted locally. No personal information is
          collected.
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
