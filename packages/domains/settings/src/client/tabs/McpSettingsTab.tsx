import { useEffect, useState } from 'react'
import { Input, Label } from '@slayzone/ui'
import { useSetting, useSetSettingMutation } from '../queries'
import { SettingsTabIntro } from './SettingsTabIntro'

export function McpSettingsTab() {
  const setSetting = useSetSettingMutation()
  const savedPreferredPort = useSetting('mcp_preferred_port') ?? ''
  const actualPort = useSetting('mcp_server_port') ?? ''

  const [preferredPortDraft, setPreferredPortDraft] = useState<string | null>(null)
  const preferredPort = preferredPortDraft ?? savedPreferredPort

  useEffect(() => {
    if (preferredPortDraft === null) return
    if (preferredPortDraft === savedPreferredPort) setPreferredPortDraft(null)
  }, [preferredPortDraft, savedPreferredPort])

  return (
    <>
      <SettingsTabIntro
        title="MCP"
        description="Configure the MCP server used by local tooling."
      />

      <div className="space-y-3">
        <Label className="text-base font-semibold">MCP Server</Label>
        <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
          <span className="text-sm">Preferred port</span>
          <Input
            className="w-full max-w-[120px]"
            type="number"
            placeholder="auto"
            value={preferredPort}
            onChange={(e) => setPreferredPortDraft(e.target.value)}
            onBlur={() => {
              const raw = preferredPort
              const port = parseInt(raw, 10)
              if (raw === '' || (port >= 1024 && port <= 65535)) {
                setSetting.mutate({ key: 'mcp_preferred_port', value: raw === '' ? '' : String(port) })
              }
            }}
          />
          <span className="text-sm">Active port</span>
          <span className="text-sm text-muted-foreground">{actualPort || 'not running'}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Leave empty for automatic. Restart required after changing.
        </p>
      </div>
    </>
  )
}
