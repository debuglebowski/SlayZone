import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@slayzone/transport/client'
import { Label, Switch } from '@slayzone/ui'
import { useSetSettingMutation } from '../queries'
import { SettingsTabIntro } from './SettingsTabIntro'

const LABS_FEATURES = [
  { key: 'labs_tests_panel', label: 'Tests Panel', description: 'Show test runner panel in the home tab', metaKey: 'isTestsPanelEnabled' as const },
  { key: 'labs_jira_integration', label: 'Jira Integration', description: 'Sync tasks with Jira Cloud issues', metaKey: 'isJiraIntegrationEnabled' as const },
  { key: 'labs_loop_mode', label: 'Loop Command', description: 'Repeat a prompt until acceptance criteria are met', metaKey: 'isLoopModeEnabled' as const },
] as const

function FeatureRow({ feature }: { feature: typeof LABS_FEATURES[number] }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: enabled } = useQuery(trpc.app.meta[feature.metaKey].queryOptions())
  const setSetting = useSetSettingMutation()
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor={feature.key}>{feature.label}</Label>
        <p className="text-xs text-muted-foreground">{feature.description}</p>
      </div>
      <Switch
        id={feature.key}
        checked={enabled ?? false}
        onCheckedChange={(checked) => {
          setSetting.mutate(
            { key: feature.key, value: checked ? '1' : '0' },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.app.meta[feature.metaKey].queryKey() })
              },
            },
          )
        }}
      />
    </div>
  )
}

export function LabsSettingsTab() {
  return (
    <div className="space-y-6">
      <SettingsTabIntro
        title="Labs"
        description="Try in-progress features before they are fully released. Expect behavior and UI details to evolve over time."
      />
      <div className="space-y-6">
        {LABS_FEATURES.map((f) => (
          <FeatureRow key={f.key} feature={f} />
        ))}
      </div>
    </div>
  )
}
