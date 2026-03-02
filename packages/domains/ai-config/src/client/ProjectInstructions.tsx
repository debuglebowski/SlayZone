import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Textarea, Tooltip, TooltipContent, TooltipTrigger } from '@slayzone/ui'
import type { CliProvider, ProviderSyncStatus } from '../shared'
import { PROVIDER_PATHS } from '../shared/provider-registry'
import { ProviderFileCard } from './SyncComponents'

interface ProjectInstructionsProps {
  projectId?: string | null
  projectPath?: string | null
  onChanged?: () => void
}

export function ProjectInstructions({ projectId, projectPath, onChanged }: ProjectInstructionsProps) {
  const [content, setContent] = useState('')
  const [providerStatus, setProviderStatus] = useState<Partial<Record<CliProvider, ProviderSyncStatus>>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [syncingProvider, setSyncingProvider] = useState<CliProvider | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [expandedProviders, setExpandedProviders] = useState<Set<CliProvider>>(new Set())
  const [diskContents, setDiskContents] = useState<Partial<Record<CliProvider, string>>>({})
  const [pullingProvider, setPullingProvider] = useState<CliProvider | null>(null)

  const isProject = !!projectId && !!projectPath
  const providers = Object.keys(providerStatus) as CliProvider[]

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

  // Save content to DB only (no disk writes)
  const saveContent = useCallback(async (text: string) => {
    try {
      if (isProject) {
        const result = await window.api.aiConfig.saveInstructionsContent(projectId!, projectPath!, text)
        setProviderStatus(result.providerStatus)
      } else {
        await window.api.aiConfig.saveGlobalInstructions(text)
      }
      onChanged?.()
    } catch {
      // silent
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

  const loadDiskContent = useCallback(async (provider: CliProvider) => {
    if (!projectPath) return
    const result = await window.api.aiConfig.readProviderInstructions(projectPath, provider)
    setDiskContents(prev => ({ ...prev, [provider]: result.exists ? result.content : '' }))
  }, [projectPath])

  const toggleExpanded = (provider: CliProvider) => {
    setExpandedProviders(prev => {
      const next = new Set(prev)
      if (next.has(provider)) {
        next.delete(provider)
      } else {
        next.add(provider)
        if (!(provider in diskContents)) void loadDiskContent(provider)
      }
      return next
    })
  }

  const handlePush = async (provider: CliProvider) => {
    if (!isProject) return
    setSyncingProvider(provider)
    try {
      const result = await window.api.aiConfig.pushProviderInstructions(projectId!, projectPath!, provider, content)
      setProviderStatus(result.providerStatus)
      setDiskContents(prev => ({ ...prev, [provider]: content }))
      onChanged?.()
    } finally {
      setSyncingProvider(null)
    }
  }

  const handlePull = async (provider: CliProvider) => {
    if (!isProject) return
    setPullingProvider(provider)
    try {
      const result = await window.api.aiConfig.pullProviderInstructions(projectId!, projectPath!, provider)
      setProviderStatus(result.providerStatus)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setContent(result.content)
      setDiskContents(prev => ({ ...prev, [provider]: result.content }))
      onChanged?.()
    } finally {
      setPullingProvider(null)
    }
  }

  const handleSyncAll = async () => {
    if (!isProject) return
    setSyncingAll(true)
    try {
      const result = await window.api.aiConfig.saveRootInstructions(projectId!, projectPath!, content)
      setProviderStatus(result.providerStatus)
      // Update disk contents cache for all providers
      const updated: Partial<Record<CliProvider, string>> = {}
      for (const p of providers) updated[p] = content
      setDiskContents(prev => ({ ...prev, ...updated }))
      onChanged?.()
    } finally {
      setSyncingAll(false)
    }
  }

  return (
    <div className="space-y-4">
      <Textarea
        data-testid="instructions-textarea"
        className="min-h-[300px] resize-y font-mono text-sm"
        placeholder={isProject
          ? 'Write your project instructions here. Use the buttons below to write to provider files.'
          : 'Write global instructions here. These are stored centrally and can be included in project syncs.'
        }
        value={content}
        onChange={handleChange}
      />

      {isProject && providers.length > 0 && (
        <>
          <div className="space-y-2">
            {providers.map(provider => {
              const rootPath = PROVIDER_PATHS[provider]?.rootInstructions ?? provider
              return (
                <ProviderFileCard
                  key={provider}
                  testIdPrefix="instructions"
                  provider={provider}
                  path={rootPath}
                  status={providerStatus[provider]!}
                  isPushing={syncingProvider === provider}
                  isPulling={pullingProvider === provider}
                  isExpanded={expandedProviders.has(provider)}
                  syncingAll={syncingAll}
                  disk={diskContents[provider]}
                  expected={content}
                  rightLabel="App content"
                  onToggleExpand={() => toggleExpanded(provider)}
                  onPush={() => void handlePush(provider)}
                  onPull={() => void handlePull(provider)}
                />
              )
            })}
          </div>

          {providers.length > 1 && (
            <div className="flex items-center justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button data-testid="instructions-push-all" size="sm" onClick={handleSyncAll} disabled={syncingAll || !!syncingProvider}>
                    {syncingAll && <Loader2 className="size-3.5 animate-spin" />}
                    Config → All Files
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Overwrite all provider files on disk with the current config content</TooltipContent>
              </Tooltip>
            </div>
          )}
        </>
      )}
    </div>
  )
}
