import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTRPC } from '@slayzone/transport/client'
import { Button, Label } from '@slayzone/ui'
import { useSetting } from '../queries'
import { SettingsTabIntro } from './SettingsTabIntro'

export function AboutSettingsTab() {
  const trpc = useTRPC()
  const dbPathRaw = useSetting('database_path')
  const dbPath = dbPathRaw ?? 'Default location (userData)'

  const { data: cliStatus } = useQuery(trpc.app.meta.checkCliInstalled.queryOptions())
  const [cliInstalledOverride, setCliInstalledOverride] = useState<boolean | null>(null)
  const [cliPathOverride, setCliPathOverride] = useState<string | null>(null)
  const [cliMessage, setCliMessage] = useState('')

  const cliInstalled = cliInstalledOverride ?? cliStatus?.installed ?? false
  const cliPath = cliPathOverride ?? cliStatus?.path ?? ''

  const installCli = useMutation(trpc.app.meta.installCli.mutationOptions())

  const handleInstallCli = async () => {
    setCliMessage('')
    try {
      const result = await installCli.mutateAsync()
      if (result.ok) {
        setCliInstalledOverride(true)
        if (result.path) setCliPathOverride(result.path)
        let msg = 'Installed successfully.'
        if (result.pathNotInPATH) msg += ' Note: the install directory is not in your PATH. Add it to use \'slay\' from any terminal.'
        setCliMessage(msg)
      } else if (result.elevationCancelled) {
        setCliMessage('Install cancelled. You can try again later from Settings.')
      } else if (result.permissionDenied) {
        setCliMessage(`Permission denied. Run in Terminal:\n${result.error}`)
      } else {
        setCliMessage(result.error ?? 'Install failed.')
      }
    } catch (err) {
      setCliMessage(err instanceof Error ? err.message : 'Install failed.')
    }
  }

  return (
    <div className="space-y-6">
      <SettingsTabIntro
        title="About"
        description="View runtime and environment details for your local installation, including storage location and CLI setup."
      />
      <div className="space-y-3">
        <Label className="text-base font-semibold">Database</Label>
        <div className="text-sm text-muted-foreground">
          <p>Location: {dbPath}</p>
          <p className="text-xs mt-1">Database path can be changed via command line. Restart required.</p>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-semibold">CLI Tool</Label>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <span className={cliInstalled ? 'text-green-500' : 'text-muted-foreground'}>●</span>
            {cliInstalled ? `Installed at ${cliPath || 'unknown path'}` : 'Not installed'}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={installCli.isPending}
            onClick={handleInstallCli}
          >
            {installCli.isPending ? 'Installing…' : cliInstalled ? 'Reinstall' : 'Install'}
          </Button>
        </div>
        {cliMessage && (
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{cliMessage}</pre>
        )}
      </div>
    </div>
  )
}
