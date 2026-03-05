import { useEffect, useMemo, useState } from 'react'
import type { IntegrationProvider } from '@slayzone/integrations/shared'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input
} from '@slayzone/ui'

interface ProjectIntegrationConnectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  provider: IntegrationProvider
  mode: 'connect' | 'edit'
  connectionId?: string
  onConnectionsChanged: () => Promise<void>
}

function providerLabel(provider: IntegrationProvider): string {
  return provider === 'github' ? 'GitHub' : 'Linear'
}

function credentialLabel(provider: IntegrationProvider): string {
  return provider === 'github' ? 'Personal access token' : 'Personal API key'
}

function credentialPlaceholder(provider: IntegrationProvider): string {
  return provider === 'github' ? 'github_pat_***' : 'lin_api_***'
}

function credentialGuide(provider: IntegrationProvider): { title: string; steps: string[] } {
  if (provider === 'github') {
    return {
      title: 'How to get a GitHub personal access token',
      steps: [
        'Open GitHub -> Settings.',
        'Go to Developer settings -> Personal access tokens -> Fine-grained tokens.',
        'Create a token with access to the repositories/projects you want to sync.',
        'Copy the token and paste it here (starts with github_pat_).'
      ]
    }
  }

  return {
    title: 'How to get a Linear API key',
    steps: [
      'Open Linear -> Settings.',
      'Go to Security & access -> Personal API keys.',
      'Create a new API key.',
      'Copy the key and paste it here (starts with lin_api_).'
    ]
  }
}

export function ProjectIntegrationConnectionModal({
  open,
  onOpenChange,
  projectId,
  provider,
  mode,
  connectionId,
  onConnectionsChanged
}: ProjectIntegrationConnectionModalProps): React.JSX.Element {
  const [credential, setCredential] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const guide = useMemo(() => credentialGuide(provider), [provider])
  const title = mode === 'edit' ? `Edit ${providerLabel(provider)} Connection` : `Connect ${providerLabel(provider)}`

  useEffect(() => {
    if (!open) return
    setCredential('')
    setErrorMessage('')
  }, [open, provider, mode])

  const handleSubmit = async () => {
    if (!credential.trim()) return

    setSubmitting(true)
    setErrorMessage('')
    try {
      if (mode === 'connect') {
        const nextConnection = provider === 'github'
          ? await window.api.integrations.connectGithub({ token: credential.trim(), projectId })
          : await window.api.integrations.connectLinear({ apiKey: credential.trim(), projectId })

        await window.api.integrations.setProjectConnection({
          projectId,
          provider,
          connectionId: nextConnection.id
        })
      } else {
        if (!connectionId) {
          throw new Error('No connection to edit')
        }
        await window.api.integrations.updateConnection({
          connectionId,
          credential: credential.trim()
        })
      }

      await onConnectionsChanged()
      onOpenChange(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl"
        showCloseButton={false}
        data-testid={`project-${provider}-connection-modal`}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>{title}</DialogTitle>
            <span
              className={
                mode === 'edit'
                  ? 'rounded px-2 py-0.5 text-[11px] font-medium bg-emerald-500/15 text-emerald-300'
                  : 'rounded px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground'
              }
            >
              {mode === 'edit' ? 'Connected' : 'Not connected'}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {mode === 'edit' ? `New ${credentialLabel(provider)}` : credentialLabel(provider)}
            </p>
            <div className="flex items-center gap-2">
              <Input
                id={`project-${provider}-${mode}-credential`}
                type="password"
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                placeholder={credentialPlaceholder(provider)}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSubmit()}
                disabled={!credential.trim() || submitting}
              >
                {submitting
                  ? mode === 'edit' ? 'Saving...' : 'Connecting...'
                  : mode === 'edit' ? 'Save' : 'Connect'}
              </Button>
            </div>
          </div>

          {errorMessage ? (
            <p className="text-xs text-destructive">{errorMessage}</p>
          ) : null}

          <div className="mt-5 space-y-2 rounded-md border bg-muted/40 p-4">
            <p className="text-xs font-medium text-foreground/90">{guide.title}</p>
            <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
