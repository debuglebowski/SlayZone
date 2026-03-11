import { useState, useEffect } from 'react'
import { Input, Label } from '@slayzone/ui'
import { SettingsTabIntro } from './SettingsTabIntro'

export function GeneralSettingsTab() {
  const [mcpPort, setMcpPort] = useState('45678')

  useEffect(() => {
    window.api.settings.get('mcp_server_port').then(val => setMcpPort(val ?? '45678'))
  }, [])

  return (
    <>
      <SettingsTabIntro
        title="General"
        description="Configure workspace-level behavior such as MCP server settings used by local tooling."
      />

      <div className="space-y-3">
        <Label className="text-base font-semibold">MCP Server</Label>
        <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
          <span className="text-sm">Port</span>
          <Input
            className="w-full max-w-[120px]"
            type="number"
            placeholder="45678"
            value={mcpPort}
            onChange={(e) => setMcpPort(e.target.value)}
            onBlur={() => {
              const port = parseInt(mcpPort, 10)
              if (port >= 1024 && port <= 65535) {
                window.api.settings.set('mcp_server_port', String(port))
              }
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Restart required after changing. Default: 45678
        </p>
      </div>
    </>
  )
}
