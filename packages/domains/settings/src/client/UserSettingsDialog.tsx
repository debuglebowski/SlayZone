import { useState, useEffect, useRef } from 'react'
import { XIcon } from 'lucide-react'
import { SettingsLayout } from '@slayzone/ui'
import { Button } from '@slayzone/ui'
import { Input } from '@slayzone/ui'
import { Label } from '@slayzone/ui'
import { Skeleton } from '@slayzone/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@slayzone/ui'
import { useTheme } from '@slayzone/settings'
import type { Tag } from '@slayzone/tags/shared'
import type { ThemePreference } from '@slayzone/settings/shared'
import type { ClaudeAvailability, TerminalMode } from '@slayzone/terminal/shared'
import type { DiagnosticsConfig } from '@slayzone/types'
import type { IntegrationConnectionPublic } from '@slayzone/integrations/shared'
import { AiConfigCenter } from '../../../ai-config/src/client/AiConfigCenter'

interface UserSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Array<{ id: string; name: string }>
  selectedProjectId: string | null
  initialTab?: 'general' | 'terminal' | 'integrations' | 'diagnostics' | 'ai-config' | 'tags' | 'about'
  onTabChange?: (tab: 'general' | 'terminal' | 'integrations' | 'diagnostics' | 'ai-config' | 'tags' | 'about') => void
}

export function UserSettingsDialog({
  open,
  onOpenChange,
  projects,
  selectedProjectId,
  initialTab = 'general',
  onTabChange
}: UserSettingsDialogProps) {
  const { preference, setPreference } = useTheme()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [tags, setTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6b7280')
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [dbPath, setDbPath] = useState<string>('')
  const [claudeStatus, setClaudeStatus] = useState<ClaudeAvailability | null>(null)
  const [shellSetting, setShellSetting] = useState('')
  const [defaultShell, setDefaultShell] = useState('')
  const [worktreeBasePath, setWorktreeBasePath] = useState('')
  const [autoCreateWorktreeOnTaskCreate, setAutoCreateWorktreeOnTaskCreate] = useState(false)
  const [defaultTerminalMode, setDefaultTerminalMode] = useState<TerminalMode>('claude-code')
  const [defaultClaudeFlags, setDefaultClaudeFlags] = useState('--dangerously-skip-permissions')
  const [defaultCodexFlags, setDefaultCodexFlags] = useState('--full-auto --search')
  const [diagnosticsConfig, setDiagnosticsConfig] = useState<DiagnosticsConfig | null>(null)
  const [retentionDaysInput, setRetentionDaysInput] = useState('14')
  const [exportRange, setExportRange] = useState<'15m' | '1h' | '24h' | '7d'>('1h')
  const [exportingDiagnostics, setExportingDiagnostics] = useState(false)
  const [diagnosticsMessage, setDiagnosticsMessage] = useState('')
  const [linearApiKey, setLinearApiKey] = useState('')
  const [linearAccountLabel, setLinearAccountLabel] = useState('')
  const [connections, setConnections] = useState<IntegrationConnectionPublic[]>([])
  const [syncingIntegrations, setSyncingIntegrations] = useState(false)
  const [integrationsMessage, setIntegrationsMessage] = useState('')
  const loadRequestIdRef = useRef(0)

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab)
      loadData()
    }
  }, [open, initialTab])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  const loadData = async () => {
    const requestId = ++loadRequestIdRef.current
    const isStale = () => requestId !== loadRequestIdRef.current

    try {
      const [loadedTags, path, shell, wtBasePath, autoCreateWorktree, termMode, claudeFlags, codexFlags] = await Promise.allSettled([
        window.api.tags.getTags(),
        window.api.settings.get('database_path'),
        window.api.settings.get('shell'),
        window.api.settings.get('worktree_base_path'),
        window.api.settings.get('auto_create_worktree_on_task_create'),
        window.api.settings.get('default_terminal_mode'),
        window.api.settings.get('default_claude_flags'),
        window.api.settings.get('default_codex_flags')
      ])
      if (isStale()) return

      setTags(loadedTags.status === 'fulfilled' ? loadedTags.value : [])
      setDbPath(path.status === 'fulfilled' ? (path.value ?? 'Default location (userData)') : 'Default location (userData)')
      setShellSetting(shell.status === 'fulfilled' ? (shell.value ?? '') : '')
      const envShell = typeof process !== 'undefined' ? process.env?.SHELL : undefined
      setDefaultShell(envShell || '/bin/bash')
      setWorktreeBasePath(wtBasePath.status === 'fulfilled' ? (wtBasePath.value ?? '') : '')
      setAutoCreateWorktreeOnTaskCreate(
        autoCreateWorktree.status === 'fulfilled' ? autoCreateWorktree.value === '1' : false
      )

      const safeMode =
        termMode.status === 'fulfilled' &&
        (termMode.value === 'claude-code' || termMode.value === 'codex' || termMode.value === 'terminal')
          ? termMode.value
          : 'claude-code'
      setDefaultTerminalMode(safeMode)

      setDefaultClaudeFlags(
        claudeFlags.status === 'fulfilled'
          ? (claudeFlags.value ?? '--dangerously-skip-permissions')
          : '--dangerously-skip-permissions'
      )
      setDefaultCodexFlags(
        codexFlags.status === 'fulfilled'
          ? (codexFlags.value ?? '--full-auto --search')
          : '--full-auto --search'
      )

      try {
        const diagConfig = await window.api.diagnostics.getConfig()
        if (isStale()) return
        setDiagnosticsConfig(diagConfig)
        setRetentionDaysInput(String(diagConfig.retentionDays))
        setDiagnosticsMessage('')
      } catch (err) {
        if (isStale()) return
        setDiagnosticsMessage(err instanceof Error ? err.message : String(err))
      }

      try {
        const loadedConnections = await window.api.integrations.listConnections('linear')
        if (isStale()) return
        setConnections(loadedConnections)
        setIntegrationsMessage('')
      } catch (err) {
        if (isStale()) return
        setIntegrationsMessage(err instanceof Error ? err.message : String(err))
      }

      void window.api.claude.checkAvailability().then((status) => {
        if (isStale()) return
        setClaudeStatus(status)
      })
    } catch (err) {
      if (isStale()) return
      setIntegrationsMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleConnectLinear = async () => {
    if (!linearApiKey.trim()) return
    try {
      const connection = await window.api.integrations.connectLinear({
        apiKey: linearApiKey.trim(),
        accountLabel: linearAccountLabel.trim() || undefined
      })
      await loadData()
      setLinearApiKey('')
      setIntegrationsMessage(`Connected to ${connection.workspace_name}`)
    } catch (err) {
      setIntegrationsMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDisconnectLinear = async (connectionId: string) => {
    await window.api.integrations.disconnect(connectionId)
    await loadData()
  }

  const handleSyncAll = async () => {
    setSyncingIntegrations(true)
    setIntegrationsMessage('')
    try {
      const result = await window.api.integrations.syncNow({})
      const errSuffix = result.errors.length > 0 ? `, ${result.errors.length} errors` : ''
      setIntegrationsMessage(`Sync complete: ${result.scanned} links, ${result.pulled} pulled, ${result.pushed} pushed${errSuffix}`)
    } finally {
      setSyncingIntegrations(false)
    }
  }

  const updateDiagnosticsConfig = async (partial: Partial<DiagnosticsConfig>) => {
    const next = await window.api.diagnostics.setConfig(partial)
    setDiagnosticsConfig(next)
    setRetentionDaysInput(String(next.retentionDays))
    return next
  }

  const handleExportDiagnostics = async () => {
    setExportingDiagnostics(true)
    setDiagnosticsMessage('')
    try {
      const now = Date.now()
      const fromByRange: Record<typeof exportRange, number> = {
        '15m': now - 15 * 60 * 1000,
        '1h': now - 60 * 60 * 1000,
        '24h': now - 24 * 60 * 60 * 1000,
        '7d': now - 7 * 24 * 60 * 60 * 1000
      }
      const result = await window.api.diagnostics.export({
        fromTsMs: fromByRange[exportRange],
        toTsMs: now
      })
      if (result.success) {
        setDiagnosticsMessage(`Exported ${result.eventCount ?? 0} events`)
      } else if (result.canceled) {
        setDiagnosticsMessage('Export canceled')
      } else {
        setDiagnosticsMessage(result.error ?? 'Export failed')
      }
    } finally {
      setExportingDiagnostics(false)
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    const tag = await window.api.tags.createTag({
      name: newTagName.trim(),
      color: newTagColor
    })
    setTags([...tags, tag])
    setNewTagName('')
    setNewTagColor('#6b7280')
  }

  const handleUpdateTag = async () => {
    if (!editingTag || !editingTag.name.trim()) return
    const updated = await window.api.tags.updateTag({
      id: editingTag.id,
      name: editingTag.name.trim(),
      color: editingTag.color
    })
    setTags(tags.map((t) => (t.id === updated.id ? updated : t)))
    setEditingTag(null)
  }

  const handleDeleteTag = async (id: string) => {
    await window.api.tags.deleteTag(id)
    setTags(tags.filter((t) => t.id !== id))
  }

  const navItems: Array<{ key: typeof activeTab; label: string }> = [
    { key: 'general', label: 'General' },
    { key: 'terminal', label: 'Terminal' },
    { key: 'integrations', label: 'Integrations' },
    { key: 'diagnostics', label: 'Diagnostics' },
    { key: 'ai-config', label: 'Global Context Manager' },
    { key: 'tags', label: 'Tags' },
    { key: 'about', label: 'About' }
  ]

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="fixed inset-0 bg-black/50" onMouseDown={() => onOpenChange(false)} />
      <div className="fixed top-[50%] left-[50%] z-50 grid h-[88vh] !w-[94vw] !max-w-[94vw] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-lg border bg-background p-0 shadow-lg outline-none sm:!w-[94vw] sm:!max-w-[94vw] xl:!max-w-[1320px]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="border-b px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg leading-none font-semibold">Settings</h2>
            <button
              type="button"
              className="ring-offset-background focus:ring-ring hover:bg-accent rounded-xs p-1 opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </div>

        <SettingsLayout
          items={navItems}
          activeKey={activeTab}
          onSelect={(key) => {
            const tab = key as typeof activeTab
            setActiveTab(tab)
            onTabChange?.(tab)
          }}
        >
          <div className="mx-auto w-full max-w-4xl space-y-4">
            {activeTab === 'general' && (
              <>
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Appearance</Label>
                  <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
                    <span className="text-sm">Theme</span>
                    <Select value={preference} onValueChange={(v) => setPreference(v as ThemePreference)}>
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Git</Label>
                  <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
                    <span className="text-sm">Worktree base path</span>
                    <Input
                      className="w-full max-w-lg"
                      placeholder="{project}/.."
                      value={worktreeBasePath}
                      onChange={(e) => setWorktreeBasePath(e.target.value)}
                      onBlur={() => {
                        window.api.settings.set('worktree_base_path', worktreeBasePath.trim())
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
                    <span className="text-sm">Auto-create worktree</span>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={autoCreateWorktreeOnTaskCreate}
                        onChange={(e) => {
                          const enabled = e.target.checked
                          setAutoCreateWorktreeOnTaskCreate(enabled)
                          window.api.settings.set(
                            'auto_create_worktree_on_task_create',
                            enabled ? '1' : '0'
                          )
                        }}
                      />
                      <span>Create worktree for every new task</span>
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use {'{project}'} as a token. Leave empty to use {'{project}/..'}.
                    Project settings can override auto-create behavior.
                  </p>
                </div>
              </>
            )}

            {activeTab === 'terminal' && (
              <>
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Mode</Label>
                  <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
                    <span className="text-sm">Default mode</span>
                    <Select
                      value={defaultTerminalMode}
                      onValueChange={(v) => {
                        const mode = v as TerminalMode
                        setDefaultTerminalMode(mode)
                        window.api.settings.set('default_terminal_mode', mode)
                      }}
                    >
                      <SelectTrigger className="w-full max-w-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="claude-code">Claude Code</SelectItem>
                        <SelectItem value="codex">Codex</SelectItem>
                        <SelectItem value="terminal">Terminal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">Mode used when creating new tasks</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Shell</Label>
                  <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
                    <span className="text-sm">Default shell</span>
                    <Input
                      className="w-full max-w-lg"
                      placeholder={defaultShell}
                      value={shellSetting}
                      onChange={(e) => setShellSetting(e.target.value)}
                      onBlur={() => {
                        if (shellSetting.trim()) {
                          window.api.settings.set('shell', shellSetting.trim())
                        } else {
                          window.api.settings.set('shell', '')
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Leave empty to use system default</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Flags</Label>
                  <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
                    <span className="text-sm">Default Claude flags</span>
                    <Input
                      className="w-full max-w-xl"
                      value={defaultClaudeFlags}
                      onChange={(e) => setDefaultClaudeFlags(e.target.value)}
                      onBlur={() => window.api.settings.set('default_claude_flags', defaultClaudeFlags.trim())}
                    />
                  </div>
                  <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
                    <span className="text-sm">Default Codex flags</span>
                    <Input
                      className="w-full max-w-xl"
                      value={defaultCodexFlags}
                      onChange={(e) => setDefaultCodexFlags(e.target.value)}
                      onBlur={() => window.api.settings.set('default_codex_flags', defaultCodexFlags.trim())}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Applied to new tasks only.</p>
                </div>
              </>
            )}

            {activeTab === 'integrations' && (
              <div className="space-y-2">
                <Label className="text-base font-semibold">Linear</Label>
                <div className="space-y-2 rounded border p-3">
                  <div className="space-y-1">
                    <Label htmlFor="linear-account-label" className="text-xs">Account label (optional)</Label>
                    <Input
                      id="linear-account-label"
                      value={linearAccountLabel}
                      onChange={(e) => setLinearAccountLabel(e.target.value)}
                      placeholder="Work email label"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="linear-api-key" className="text-xs">Personal API key</Label>
                    <Input
                      id="linear-api-key"
                      type="password"
                      value={linearApiKey}
                      onChange={(e) => setLinearApiKey(e.target.value)}
                      placeholder="lin_api_***"
                    />
                  </div>
                  <Button onClick={handleConnectLinear} disabled={!linearApiKey.trim()}>
                    Connect Linear
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    API key is stored using OS-backed secure storage.
                  </p>
                </div>

                <div className="space-y-2 rounded border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Connections</Label>
                    <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={syncingIntegrations}>
                      {syncingIntegrations ? 'Syncing…' : 'Sync Now'}
                    </Button>
                  </div>
                  {connections.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No Linear connection yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {connections.map((connection) => (
                        <div key={connection.id} className="flex items-center gap-2 rounded bg-muted/40 p-2 text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{connection.workspace_name}</p>
                            <p className="truncate text-xs text-muted-foreground">{connection.account_label}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleDisconnectLinear(connection.id)}>
                            Disconnect
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {integrationsMessage ? (
                    <p className="text-xs text-muted-foreground">{integrationsMessage}</p>
                  ) : null}
                </div>
              </div>
            )}

            {activeTab === 'diagnostics' && (
              <>
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Logging</Label>
                  <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
                    <span className="text-sm">Diagnostics enabled</span>
                    <input
                      type="checkbox"
                      checked={diagnosticsConfig?.enabled ?? true}
                      onChange={(e) => {
                        updateDiagnosticsConfig({ enabled: e.target.checked })
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
                    <span className="text-sm">Verbose logging</span>
                    <input
                      type="checkbox"
                      checked={diagnosticsConfig?.verbose ?? false}
                      onChange={(e) => {
                        updateDiagnosticsConfig({ verbose: e.target.checked })
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
                    <span className="text-sm">Include PTY output content</span>
                    <input
                      type="checkbox"
                      checked={diagnosticsConfig?.includePtyOutput ?? false}
                      onChange={(e) => {
                        updateDiagnosticsConfig({ includePtyOutput: e.target.checked })
                      }}
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

                <div className="space-y-2">
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
                  <Button onClick={handleExportDiagnostics} disabled={exportingDiagnostics}>
                    {exportingDiagnostics ? 'Exporting…' : 'Export Diagnostics'}
                  </Button>
                  {diagnosticsMessage ? (
                    <p className="text-xs text-muted-foreground">{diagnosticsMessage}</p>
                  ) : null}
                </div>
              </>
            )}

            {activeTab === 'ai-config' && (
              <div className="h-[calc(88vh-210px)] min-h-[560px] overflow-hidden rounded-lg border">
                <AiConfigCenter
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  scopeMode="global"
                  layoutMode="embedded"
                />
              </div>
            )}

            {activeTab === 'tags' && (
              <div className="space-y-4">
                <Label className="text-base font-semibold">Tags</Label>
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div key={tag.id} className="flex items-center gap-2">
                      {editingTag?.id === tag.id ? (
                        <>
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: editingTag.color }}
                          />
                          <Input
                            value={editingTag.name}
                            onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                            className="flex-1 h-8"
                          />
                          <Button size="sm" variant="ghost" onClick={handleUpdateTag}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingTag(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="flex-1">{tag.name}</span>
                          <Button size="sm" variant="ghost" onClick={() => setEditingTag({ ...tag })}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => handleDeleteTag(tag.id)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="new-tag" className="text-xs">New tag</Label>
                    <Input
                      id="new-tag"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Tag name"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Color</Label>
                    <Input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-12 h-9 p-1 cursor-pointer"
                    />
                  </div>
                  <Button onClick={handleCreateTag} disabled={!newTagName.trim()}>
                    Add
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <>
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Database</Label>
                  <div className="text-sm text-muted-foreground">
                    <p>Location: {dbPath}</p>
                    <p className="text-xs mt-1">Database path can be changed via command line. Restart required.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Claude Code</Label>
                  {claudeStatus === null ? (
                    <Skeleton className="h-4 w-40" />
                  ) : claudeStatus.available ? (
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-green-500" />
                      <span className="text-sm">{claudeStatus.version}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-red-500" />
                      <span className="text-sm text-muted-foreground">Not installed</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </SettingsLayout>
      </div>
    </div>
  )
}
