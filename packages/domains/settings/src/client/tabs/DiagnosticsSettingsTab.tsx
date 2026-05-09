import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@slayzone/ui'
import type { DiagnosticsConfig } from '@slayzone/diagnostics/shared'
import { useTRPC, useTRPCClient } from '@slayzone/transport/client'
import { SettingsTabIntro } from './SettingsTabIntro'

export function DiagnosticsSettingsTab() {
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()

  const { data: diagnosticsConfig } = useQuery(trpc.diagnostics.getConfig.queryOptions())
  const [retentionDaysInput, setRetentionDaysInput] = useState('14')
  const [exportRange, setExportRange] = useState<'15m' | '1h' | '24h' | '7d'>('1h')
  const [diagnosticsMessage, setDiagnosticsMessage] = useState('')

  // Sync editable retention input with the loaded config (one-way).
  useEffect(() => {
    if (diagnosticsConfig) setRetentionDaysInput(String(diagnosticsConfig.retentionDays))
  }, [diagnosticsConfig?.retentionDays])

  const updateConfig = useMutation(
    trpc.diagnostics.setConfig.mutationOptions({
      onSuccess: (next) => {
        queryClient.setQueryData(trpc.diagnostics.getConfig.queryKey(), next)
      },
    }),
  )

  const exportBundle = useMutation({
    mutationFn: async (input: Parameters<typeof trpcClient.diagnostics.exportBundle.query>[0]) =>
      trpcClient.diagnostics.exportBundle.query(input),
  })

  const handleExportDiagnostics = async () => {
    setDiagnosticsMessage('')
    try {
      const now = Date.now()
      const fromByRange: Record<typeof exportRange, number> = {
        '15m': now - 15 * 60 * 1000,
        '1h': now - 60 * 60 * 1000,
        '24h': now - 24 * 60 * 60 * 1000,
        '7d': now - 7 * 24 * 60 * 60 * 1000,
      }
      const appVersion = await trpcClient.app.meta.getVersion.query()
      const bundle = await exportBundle.mutateAsync({
        fromTsMs: fromByRange[exportRange],
        toTsMs: now,
        appVersion,
        platform: navigator.platform || 'unknown',
      })
      if (!bundle) {
        setDiagnosticsMessage('Export failed: diagnostics DB not available')
        return
      }
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const fileName = `slayzone-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setDiagnosticsMessage(`Exported ${bundle.events.length} events to ${fileName}`)
    } catch (err) {
      setDiagnosticsMessage(err instanceof Error ? err.message : 'Export failed')
    }
  }

  const updateDiagnosticsConfig = (partial: Partial<DiagnosticsConfig>) => {
    updateConfig.mutate(partial)
  }

  return (
    <div className="space-y-6">
      <SettingsTabIntro
        title="Diagnostics"
        description="Control debug logging and export diagnostic bundles for troubleshooting."
      />
      <div className="space-y-3">
        <Label className="text-base font-semibold">Logging</Label>
        <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
          <span className="text-sm">Diagnostics enabled</span>
          <input
            type="checkbox"
            checked={diagnosticsConfig?.enabled ?? true}
            onChange={(e) => updateDiagnosticsConfig({ enabled: e.target.checked })}
          />
        </div>
        <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
          <span className="text-sm">Verbose logging</span>
          <input
            type="checkbox"
            checked={diagnosticsConfig?.verbose ?? false}
            onChange={(e) => updateDiagnosticsConfig({ verbose: e.target.checked })}
          />
        </div>
        <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
          <span className="text-sm">Include PTY output content</span>
          <input
            type="checkbox"
            checked={diagnosticsConfig?.includePtyOutput ?? false}
            onChange={(e) => updateDiagnosticsConfig({ includePtyOutput: e.target.checked })}
          />
        </div>
        <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
          <span className="text-sm">Retention days</span>
          <Input
            className="w-full max-w-24"
            inputMode="numeric"
            value={retentionDaysInput}
            onChange={(e) => setRetentionDaysInput(e.target.value)}
            onBlur={() => {
              const parsed = Number.parseInt(retentionDaysInput, 10)
              if (Number.isFinite(parsed) && parsed > 0) {
                updateDiagnosticsConfig({ retentionDays: parsed })
              } else if (diagnosticsConfig) {
                setRetentionDaysInput(String(diagnosticsConfig.retentionDays))
              }
            }}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-semibold">Export</Label>
        <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
          <span className="text-sm">Time range</span>
          <Select value={exportRange} onValueChange={(v) => setExportRange(v as typeof exportRange)}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15m">Last 15 minutes</SelectItem>
              <SelectItem value="1h">Last 1 hour</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleExportDiagnostics} disabled={exportBundle.isPending}>
          {exportBundle.isPending ? 'Exporting…' : 'Export Diagnostics'}
        </Button>
        {diagnosticsMessage ? (
          <p className="text-xs text-muted-foreground">{diagnosticsMessage}</p>
        ) : null}
      </div>
    </div>
  )
}
