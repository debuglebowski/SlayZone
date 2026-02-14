import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Star, Check, Search } from 'lucide-react'
import { Button, Input } from '@slayzone/ui'
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

  const filtered = useMemo(() =>
    CURATED_MCP_SERVERS
      .filter((s) => matchesSearch(search, s.name, s.description, s.category))
      .sort((a, b) => {
        const af = favorites.includes(a.id) ? 0 : 1
        const bf = favorites.includes(b.id) ? 0 : 1
        return af - bf
      }),
    [favorites, search]
  )

  return (
    <div className="space-y-4">
      <SearchInput value={search} onChange={setSearch} />

      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {filtered.map((s) => (
            <ServerCard
              key={s.id}
              server={s}
              actions={
                <button
                  onClick={() => toggleFavorite(s.id)}
                  className="rounded p-0.5 transition-colors hover:bg-muted"
                  title={favorites.includes(s.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className={favorites.includes(s.id) ? 'size-3.5 fill-amber-400 text-amber-400' : 'size-3.5 text-muted-foreground'} />
                </button>
              }
            />
          ))}
        </div>
      ) : search ? (
        <p className="text-sm text-muted-foreground">No servers match your search.</p>
      ) : null}
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

function ProjectMcpPanel({ projectPath }: ProjectMcpPanelProps) {
  const [configs, setConfigs] = useState<McpConfigFileResult[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
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

  const isFavorite = (id: string) => favorites.includes(id)

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
    for (const provider of ALL_PROVIDERS) {
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
      </div>
      <div className="flex shrink-0 items-center gap-1">
<Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-destructive" onClick={() => disableServer(s)}>
          Disable
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <SearchInput value={search} onChange={setSearch} />

      {/* Enabled servers */}
      {enabledServers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Enabled</p>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            {enabledServers.map((s) => s.curated ? (
              <ServerCard
                key={s.key}
                server={s.curated}
                actions={
                  <button
                    onClick={() => toggleFavorite(s.key)}
                    className="rounded p-0.5 transition-colors hover:bg-muted"
                    title={isFavorite(s.key) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star className={isFavorite(s.key) ? 'size-3.5 fill-amber-400 text-amber-400' : 'size-3.5 text-muted-foreground'} />
                  </button>
                }
                footer={enabledFooter(s)}
              />
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
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            {[...availableServers].sort((a, b) => {
              const af = isFavorite(a.key) ? 0 : 1
              const bf = isFavorite(b.key) ? 0 : 1
              return af - bf
            }).map((s) => (
              <ServerCard
                key={s.key}
                server={s.curated!}
                actions={
                  <button
                    onClick={() => toggleFavorite(s.key)}
                    className="rounded p-0.5 transition-colors hover:bg-muted"
                    title={isFavorite(s.key) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star className={isFavorite(s.key) ? 'size-3.5 fill-amber-400 text-amber-400' : 'size-3.5 text-muted-foreground'} />
                  </button>
                }
                footer={
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-full text-[10px]"
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
