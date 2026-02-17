import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Check, AlertCircle } from 'lucide-react'
import { Textarea } from '@slayzone/ui'
import type { CliProvider, ProviderSyncStatus } from '../shared'
import { PROVIDER_LABELS, PROVIDER_PATHS } from '../shared/provider-registry'

interface ProjectInstructionsProps {
  projectId?: string | null
  projectPath?: string | null
  onChanged?: () => void
}

function StatusIcon({ status }: { status: ProviderSyncStatus }) {
  if (status === 'synced') return <Check className="size-3 text-green-600 dark:text-green-400" />
  if (status === 'out_of_sync') return <AlertCircle className="size-3 text-amber-600 dark:text-amber-400" />
  return <span className="size-3 rounded-full border border-dashed border-muted-foreground" />
}

export function ProjectInstructions({ projectId, projectPath, onChanged }: ProjectInstructionsProps) {
  const [content, setContent] = useState('')
  const [providerStatus, setProviderStatus] = useState<Partial<Record<CliProvider, ProviderSyncStatus>>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isProject = !!projectId && !!projectPath

  const load = useCallback(async () => {
    if (isProject) {
      const result = await window.api.aiConfig.getRootInstructions(projectId!, projectPath!)
      setContent(result.content)
      setProviderStatus(result.providerStatus)
    } else {
      const text = await window.api.aiConfig.getGlobalInstructions()
      setContent(text)
    }
  }, [isProject, projectId, projectPath])

  useEffect(() => { void load() }, [load])

  const saveContent = useCallback(async (text: string) => {
    try {
      if (isProject) {
        const result = await window.api.aiConfig.saveRootInstructions(projectId!, projectPath!, text)
        setProviderStatus(result.providerStatus)
      } else {
        await window.api.aiConfig.saveGlobalInstructions(text)
      }
      onChanged?.()
    } catch {
      // silent — status icons will reflect the issue
    }
  }, [isProject, projectId, projectPath, onChanged])

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setContent(text)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void saveContent(text), 800)
  }

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  const providers = Object.keys(providerStatus) as CliProvider[]

  return (
    <div className="space-y-4">
      <Textarea
        className="min-h-[300px] resize-y font-mono text-sm"
        placeholder={isProject
          ? 'Write your project instructions here. This content will sync to all enabled providers.'
          : 'Write global instructions here. These are stored centrally and can be included in project syncs.'
        }
        value={content}
        onChange={handleChange}
      />

      {providers.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {providers.map(provider => {
            const status = providerStatus[provider]!
            const rootPath = PROVIDER_PATHS[provider]?.rootInstructions
            return (
              <div key={provider} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <StatusIcon status={status} />
                <span>{rootPath ?? PROVIDER_LABELS[provider]}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
