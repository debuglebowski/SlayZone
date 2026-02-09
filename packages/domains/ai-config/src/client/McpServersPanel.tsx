import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Star, Check, AlertTriangle, Search } from 'lucide-react'
import { Button, cn, Input } from '@slayzone/ui'
import { CURATED_MCP_SERVERS, CATEGORY_LABELS, type CuratedMcpServer } from '../shared/mcp-registry'
import type { McpConfigFileResult, McpProvider, McpServerConfig } from '../shared'

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function matchesSearch(query: string, ...fields: (string | undefined)[]) {
  if (!query) return true
  const q = query.toLowerCase()
  return fields.some((f) => f?.toLowerCase().includes(q))
}

function ServerCard({ server, actions, footer }: {
  server: CuratedMcpServer
  actions?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50">
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-tight">{server.name}</span>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            <a href={server.url} target="_blank" rel="noopener noreferrer" className="rounded p-0.5 transition-colors hover:bg-muted">
              <ExternalLink className="size-3 text-muted-foreground" />
            </a>
          </div>
        </div>
        <span className="mt-1 inline-block rounded border px-1.5 py-0 text-[10px] text-muted-foreground">
          {CATEGORY_LABELS[server.category]}
        </span>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{server.description}</p>
      </div>
      {footer && <div className="mt-2 border-t pt-2">{footer}</div>}
    </div>
  )
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search servers..."
        className="h-8 pl-8 text-xs"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Global mode
// ---------------------------------------------------------------------------

function GlobalMcpPanel() {
  const [favorites, setFavorites] = useState<string[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    void window.api.settings.get('mcp_favorites').then((raw) => {
      if (raw) setFavorites(JSON.parse(raw) as string[])
    })
  }, [])

  const toggleFavorite = async (id: string) => {
    const next = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id]
    setFavorites(next)
    await window.api.settings.set('mcp_favorites', JSON.stringify(next))
  }

  const favServers = useMemo(() =>
    CURATED_MCP_SERVERS.filter((s) => favorites.includes(s.id) && matchesSearch(search, s.name, s.description, s.category)),
    [favorites, search]
  )
  const otherServers = useMemo(() =>
    CURATED_MCP_SERVERS.filter((s) => !favorites.includes(s.id) && matchesSearch(search, s.name, s.description, s.category)),
    [favorites, search]
  )

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Curated MCP servers. Star your favorites for quick access.
      </p>

      <SearchInput value={search} onChange={setSearch} />

      {favServers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Favorites</p>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {favServers.map((s) => (
              <ServerCard
                key={s.id}
                server={s}
                actions={
                  <button
                    onClick={() => toggleFavorite(s.id)}
                    className="rounded p-0.5 transition-colors hover:bg-muted"
                    title="Remove from favorites"
                  >
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  </button>
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {favServers.length > 0 && (
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">All Servers</p>
        )}
        {otherServers.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {otherServers.map((s) => (
              <ServerCard
                key={s.id}
                server={s}
                actions={
                  <button
                    onClick={() => toggleFavorite(s.id)}
                    className="rounded p-0.5 transition-colors hover:bg-muted"
                    title="Add to favorites"
                  >
                    <Star className="size-3.5 text-muted-foreground" />
                  </button>
                }
              />
            ))}
          </div>
        ) : search && favServers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No servers match your search.</p>
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Project mode
// ---------------------------------------------------------------------------

const PROVIDER_LABELS: Record<McpProvider, string> = {
  claude: 'Claude Code',
  cursor: 'Cursor',
  vscode: 'VSCode'
}

const ALL_PROVIDERS: McpProvider[] = ['claude', 'cursor', 'vscode']

interface ProjectMcpPanelProps {
  projectPath: string
  projectId: string
}

interface MergedServer {
  key: string
  curated: CuratedMcpServer | null
  config: McpServerConfig | null
  providers: McpProvider[]
}

function ProjectMcpPanel({ projectPath, projectId }: ProjectMcpPanelProps) {
  const [configs, setConfigs] = useState<McpConfigFileResult[]>([])
  const [selectedProviders, setSelectedProviders] = useState<McpProvider[]>(['claude'])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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

  useEffect(() => {
    void window.api.settings.get(`mcp_providers:${projectId}`).then((raw) => {
      if (raw) setSelectedProviders(JSON.parse(raw) as McpProvider[])
    })
  }, [projectId])

  const toggleProvider = async (p: McpProvider) => {
    const next = selectedProviders.includes(p)
      ? selectedProviders.filter((x) => x !== p)
      : [...selectedProviders, p]
    setSelectedProviders(next)
    await window.api.settings.set(`mcp_providers:${projectId}`, JSON.stringify(next))
  }

  // Merge configs into unified server list
  const merged: MergedServer[] = []
  const seen = new Set<string>()

  for (const curated of CURATED_MCP_SERVERS) {
    const providers: McpProvider[] = []
    let foundConfig: McpServerConfig | null = null
    for (const cfg of configs) {
      if (cfg.servers[curated.id]) {
        providers.push(cfg.provider)
        if (!foundConfig) foundConfig = cfg.servers[curated.id]
      }
    }
    merged.push({ key: curated.id, curated, config: foundConfig, providers })
    seen.add(curated.id)
  }

  for (const cfg of configs) {
    for (const [key, config] of Object.entries(cfg.servers)) {
      if (seen.has(key)) continue
      const existing = merged.find((m) => m.key === key)
      if (existing) {
        existing.providers.push(cfg.provider)
      } else {
        merged.push({ key, curated: null, config, providers: [cfg.provider] })
        seen.add(key)
      }
    }
  }

  const enableServer = async (server: MergedServer) => {
    const config = server.curated ? { ...server.curated.template } : server.config
    if (!config) return
    for (const provider of selectedProviders) {
      if (server.providers.includes(provider)) continue
      await window.api.aiConfig.writeMcpServer({
        projectPath,
        provider,
        serverKey: server.key,
        config
      })
    }
    await loadConfigs()
  }

  const disableServer = async (server: MergedServer) => {
    for (const provider of server.providers) {
      await window.api.aiConfig.removeMcpServer({
        projectPath,
        provider,
        serverKey: server.key
      })
    }
    await loadConfigs()
  }

  const isEnabled = (server: MergedServer) => server.providers.length > 0
  const hasDrift = (server: MergedServer) => {
    if (!isEnabled(server)) return false
    return selectedProviders.some((p) => !server.providers.includes(p))
  }

  const filterServer = (s: MergedServer) =>
    matchesSearch(search, s.curated?.name ?? s.key, s.curated?.description, s.curated?.category)

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>

  const enabledServers = merged.filter((s) => isEnabled(s) && filterServer(s))
  const availableServers = merged.filter((m) => !isEnabled(m) && m.curated && filterServer(m))

  const enabledFooter = (s: MergedServer) => (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {s.providers.map((p) => (
          <span key={p} className="flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400">
            <Check className="size-2.5" /> {PROVIDER_LABELS[p]}
          </span>
        ))}
        {hasDrift(s) && (
          <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-2.5" />
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {hasDrift(s) && (
          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => enableServer(s)}>
            Sync
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-destructive" onClick={() => disableServer(s)}>
          Disable
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Provider selector */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Target Providers</p>
        <div className="flex flex-wrap gap-2">
          {ALL_PROVIDERS.map((p) => (
            <button
              key={p}
              onClick={() => toggleProvider(p)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                selectedProviders.includes(p)
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {PROVIDER_LABELS[p]}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Enabling a server writes its config to all selected providers.
        </p>
      </div>

      <SearchInput value={search} onChange={setSearch} />

      {/* Enabled servers */}
      {enabledServers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Enabled</p>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {enabledServers.map((s) => s.curated ? (
              <ServerCard key={s.key} server={s.curated} footer={enabledFooter(s)} />
            ) : (
              <div key={s.key} className="flex flex-col justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50">
                <div>
                  <span className="text-sm font-medium leading-tight">{s.key}</span>
                  <span className="mt-1 inline-block rounded border px-1.5 py-0 text-[10px] text-muted-foreground">Custom</span>
                </div>
                <div className="mt-2 border-t pt-2">{enabledFooter(s)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available curated servers */}
      {availableServers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Available</p>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {availableServers.map((s) => (
              <ServerCard
                key={s.key}
                server={s.curated!}
                footer={
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-full text-[10px]"
                    disabled={selectedProviders.length === 0}
                    onClick={() => enableServer(s)}
                  >
                    Enable
                  </Button>
                }
              />
            ))}
          </div>
        </div>
      )}

      {search && enabledServers.length === 0 && availableServers.length === 0 && (
        <p className="text-sm text-muted-foreground">No servers match your search.</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

interface McpServersPanelProps {
  mode: 'global' | 'project'
  projectPath?: string
  projectId?: string
}

export function McpServersPanel({ mode, projectPath, projectId }: McpServersPanelProps) {
  if (mode === 'project' && projectPath && projectId) {
    return <ProjectMcpPanel projectPath={projectPath} projectId={projectId} />
  }
  return <GlobalMcpPanel />
}
