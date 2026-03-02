import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Plus, Server, X, Search } from 'lucide-react'
import { Checkbox, cn, Dialog, DialogContent, DialogHeader, DialogTitle, IconButton, Input, toast } from '@slayzone/ui'
import type { CliProvider, McpConfigFileResult, McpServerConfig, McpTarget } from '../shared'
import { CURATED_MCP_SERVERS, type CuratedMcpServer } from '../shared/mcp-registry'

const MCP_CONFIG_PATHS: Partial<Record<McpTarget, string>> = {
  claude: '.mcp.json',
  cursor: '.cursor/mcp.json',
  gemini: '.gemini/settings.json',
  opencode: 'opencode.json',
}

interface MergedServer {
  key: string
  name: string
  description?: string
  config: McpServerConfig | null
  curated: CuratedMcpServer | null
  providers: McpTarget[]
}

interface McpFlatSectionProps {
  projectPath: string
  enabledProviders: CliProvider[]
  onChanged: () => void
}

export function McpFlatSection({ projectPath, enabledProviders, onChanged }: McpFlatSectionProps) {
  const [configs, setConfigs] = useState<McpConfigFileResult[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')

  const loadConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const results = await window.api.aiConfig.discoverMcpConfigs(projectPath)
      setConfigs(results)
    } finally {
      setLoading(false)
    }
  }, [projectPath])

  useEffect(() => { void loadConfigs() }, [loadConfigs])

  // Track which providers support writes
  const writableProviders = new Set(configs.filter(c => c.writable).map(c => c.provider))

  // Build merged server list from discovered configs
  const merged: MergedServer[] = []
  const seen = new Set<string>()

  for (const cfg of configs) {
    for (const [key, config] of Object.entries(cfg.servers)) {
      if (!seen.has(key)) {
        const curated = CURATED_MCP_SERVERS.find(c => c.id === key) ?? null
        merged.push({
          key,
          name: curated?.name ?? key,
          description: curated?.description,
          config,
          curated,
          providers: [cfg.provider]
        })
        seen.add(key)
      } else {
        const existing = merged.find(m => m.key === key)
        if (existing) existing.providers.push(cfg.provider)
      }
    }
  }

  const enabledServers = merged.filter(s => s.providers.length > 0)

  const handleToggleProvider = async (server: MergedServer, provider: McpTarget) => {
    const isPresent = server.providers.includes(provider)
    try {
      if (isPresent) {
        await window.api.aiConfig.removeMcpServer({ projectPath, provider, serverKey: server.key })
      } else {
        const config = server.config ?? server.curated?.template
        if (!config) return
        await window.api.aiConfig.writeMcpServer({ projectPath, provider, serverKey: server.key, config })
      }
      await loadConfigs()
      onChanged()
      toast.success(`${isPresent ? 'Removed' : 'Synced'} ${server.name} ${isPresent ? 'from' : 'to'} ${provider}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'MCP sync failed')
    }
  }

  const handleRemove = async (server: MergedServer) => {
    try {
      let removed = 0
      for (const provider of server.providers) {
        if (!writableProviders.has(provider)) continue
        await window.api.aiConfig.removeMcpServer({ projectPath, provider, serverKey: server.key })
        removed += 1
      }
      if (expandedKey === server.key) setExpandedKey(null)
      await loadConfigs()
      onChanged()
      if (removed > 0) {
        toast.success(`Removed ${server.name} from ${removed} provider${removed === 1 ? '' : 's'}`)
      } else {
        toast.error('No writable MCP configs available for removal')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'MCP removal failed')
    }
  }

  const handleAddFromCatalog = async (curated: CuratedMcpServer) => {
    try {
      let synced = 0
      for (const provider of enabledProviders) {
        if (!writableProviders.has(provider)) continue
        await window.api.aiConfig.writeMcpServer({
          projectPath,
          provider,
          serverKey: curated.id,
          config: { ...curated.template }
        })
        synced += 1
      }
      await loadConfigs()
      onChanged()
      if (synced > 0) {
        toast.success(`Synced ${curated.name} to ${synced} provider${synced === 1 ? '' : 's'}`)
      } else {
        toast.error('No writable providers enabled for MCP sync')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'MCP sync failed')
    }
  }

  const availableCurated = CURATED_MCP_SERVERS.filter(c => !seen.has(c.id))

  return (
    <div>
      {/* Provider column headers */}
      {enabledServers.length > 0 && (
        <div className="mb-2 flex items-center gap-2 px-3">
          <span className="min-w-0 flex-1" />
          <div className="flex items-center gap-0.5">
            <div className="w-[70px]" />
            {enabledProviders.map((provider) => (
              <span
                key={provider}
                data-testid={`project-context-mcp-provider-${provider}`}
                className="w-16 text-center text-[10px] text-muted-foreground"
              >
                {provider}
              </span>
            ))}
            <div className="w-[52px]" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-1">
          {[1, 2].map(i => (
            <div key={i} className="h-10 animate-pulse rounded-md border bg-muted/20" />
          ))}
        </div>
      ) : (
        <>
        {enabledServers.length > 0 && (
        <div className="space-y-1">
          {enabledServers.map(server => {
            const isExpanded = expandedKey === server.key
            return (
              <div key={server.key}>
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 transition-colors cursor-pointer',
                    isExpanded ? 'bg-muted/50 border-primary/30' : 'hover:bg-muted/30'
                  )}
                  onClick={() => setExpandedKey(isExpanded ? null : server.key)}
                >
                  {isExpanded
                    ? <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                    : <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                  }
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {server.name}
                  </span>

                  <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                    {/* sync badge spacer — same width as ItemSection */}
                    <div className="w-[70px]" />
                    {enabledProviders.map(p => {
                      const isPresent = server.providers.includes(p)
                      const writable = writableProviders.has(p)
                      return (
                        <span
                          key={p}
                          className="w-16 flex justify-center"
                          title={writable ? undefined : `${p} MCP config is read-only in this project`}
                        >
                          {writable ? (
                            <Checkbox
                              checked={isPresent}
                              onCheckedChange={() => handleToggleProvider(server, p)}
                            />
                          ) : (
                            <Checkbox checked={isPresent} disabled />
                          )}
                        </span>
                      )
                    })}
                    <div className="flex items-center gap-0.5">
                      {/* spacer to match sync button in ItemSection */}
                      <div className="size-6" />
                      <IconButton
                        aria-label="Remove server"
                        size="icon-sm"
                        variant="ghost"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(server)}
                      >
                        <X className="size-3" />
                      </IconButton>
                    </div>
                  </div>
                </div>

                {isExpanded && server.config && (
                  <div className="mt-1 rounded-lg border bg-muted/20 p-4 space-y-2">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Command: </span>
                      <span className="font-mono">{server.config.command} {server.config.args.join(' ')}</span>
                    </div>
                    {server.config.env && Object.keys(server.config.env).length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Env: </span>
                        {Object.entries(server.config.env).map(([k, v]) => (
                          <span key={k} className="font-mono">{k}={v} </span>
                        ))}
                      </div>
                    )}
                    {server.description && (
                      <p className="text-xs text-muted-foreground">{server.description}</p>
                    )}
                    <div className="space-y-0.5 pt-1 border-t border-border/50">
                      <span className="text-[11px] font-medium text-muted-foreground">Config files</span>
                      {enabledProviders.map(p => {
                        const configPath = MCP_CONFIG_PATHS[p]
                        if (!configPath) return null
                        const isPresent = server.providers.includes(p)
                        return (
                          <div key={p} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {isPresent
                              ? <Check className="size-2.5 text-green-600 dark:text-green-400" />
                              : <span className="size-2.5 rounded-full border border-dashed border-muted-foreground" />
                            }
                            <span className="font-mono">{configPath}</span>
                            <span className="text-muted-foreground/60">({p})</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        )}

          {/* Subtle add row */}
        <div
          className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 cursor-pointer text-muted-foreground transition-colors hover:bg-muted/15 hover:text-foreground mt-1"
          onClick={() => setShowCatalog(true)}
        >
          <Plus className="size-3 shrink-0" />
          <span className="text-xs">Add MCP server</span>
        </div>
        </>
      )}

      {/* Add MCP dialog */}
      <Dialog open={showCatalog} onOpenChange={setShowCatalog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add MCP Server</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search servers..."
              className="pl-8 h-8 text-xs"
              value={catalogSearch}
              onChange={e => setCatalogSearch(e.target.value)}
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {availableCurated
              .filter(c => !catalogSearch || c.name.toLowerCase().includes(catalogSearch.toLowerCase()) || c.description?.toLowerCase().includes(catalogSearch.toLowerCase()))
              .map(c => (
                <button
                  key={c.id}
                  onClick={async () => {
                    await handleAddFromCatalog(c)
                    setShowCatalog(false)
                    setCatalogSearch('')
                  }}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50"
                >
                  <Server className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div>
                    <div className="text-xs font-medium">{c.name}</div>
                    {c.description && <div className="text-[11px] text-muted-foreground">{c.description}</div>}
                  </div>
                </button>
              ))}
            {availableCurated.filter(c => !catalogSearch || c.name.toLowerCase().includes(catalogSearch.toLowerCase())).length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">No servers found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
