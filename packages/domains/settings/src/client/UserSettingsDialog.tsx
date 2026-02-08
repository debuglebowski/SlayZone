import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@slayzone/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@slayzone/ui'
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

interface UserSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  const { preference, setPreference } = useTheme()
  const [tags, setTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6b7280')
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [dbPath, setDbPath] = useState<string>('')
  const [claudeStatus, setClaudeStatus] = useState<ClaudeAvailability | null>(null)
  const [shellSetting, setShellSetting] = useState('')
  const [defaultShell, setDefaultShell] = useState('')
  const [worktreeBasePath, setWorktreeBasePath] = useState('')
  const [defaultTerminalMode, setDefaultTerminalMode] = useState<TerminalMode>('claude-code')
  const [defaultClaudeFlags, setDefaultClaudeFlags] = useState('--dangerously-skip-permissions')
  const [defaultCodexFlags, setDefaultCodexFlags] = useState('--full-auto --search')
  const [diagnosticsConfig, setDiagnosticsConfig] = useState<DiagnosticsConfig | null>(null)
  const [retentionDaysInput, setRetentionDaysInput] = useState('14')
  const [exportRange, setExportRange] = useState<'15m' | '1h' | '24h' | '7d'>('1h')
  const [exportingDiagnostics, setExportingDiagnostics] = useState(false)
  const [diagnosticsMessage, setDiagnosticsMessage] = useState('')

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const loadData = async () => {
    const [loadedTags, path, shell, wtBasePath, termMode, claudeFlags, codexFlags, diagConfig] = await Promise.all([
      window.api.tags.getTags(),
      window.api.settings.get('database_path'),
      window.api.settings.get('shell'),
      window.api.settings.get('worktree_base_path'),
      window.api.settings.get('default_terminal_mode'),
      window.api.settings.get('default_claude_flags'),
      window.api.settings.get('default_codex_flags'),
      window.api.diagnostics.getConfig()
    ])
    setTags(loadedTags)
    setDbPath(path ?? 'Default location (userData)')
    setShellSetting(shell ?? '')
    setDefaultShell(process.env.SHELL || '/bin/bash')
    setWorktreeBasePath(wtBasePath ?? '')
    setDefaultTerminalMode((termMode as TerminalMode) || 'claude-code')
    setDefaultClaudeFlags(claudeFlags ?? '--dangerously-skip-permissions')
    setDefaultCodexFlags(codexFlags ?? '--full-auto --search')
    setDiagnosticsConfig(diagConfig)
    setRetentionDaysInput(String(diagConfig.retentionDays))
    setDiagnosticsMessage('')
    window.api.claude.checkAvailability().then(setClaudeStatus)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="terminal">Terminal</TabsTrigger>
            <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Appearance</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm">Theme</span>
                <Select value={preference} onValueChange={(v) => setPreference(v as ThemePreference)}>
                  <SelectTrigger className="w-32">
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
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">Worktree base path</span>
                <Input
                  className="w-48"
                  placeholder="{project}/.."
                  value={worktreeBasePath}
                  onChange={(e) => setWorktreeBasePath(e.target.value)}
                  onBlur={() => {
                    window.api.settings.set('worktree_base_path', worktreeBasePath.trim())
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use {'{project}'} as a token. Leave empty to use {'{project}/..'}.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="terminal" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Mode</Label>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">Default mode</span>
                <Select
                  value={defaultTerminalMode}
                  onValueChange={(v) => {
                    const mode = v as TerminalMode
                    setDefaultTerminalMode(mode)
                    window.api.settings.set('default_terminal_mode', mode)
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-code">Claude Code</SelectItem>
                    <SelectItem value="codex">Codex</SelectItem>
                    <SelectItem value="terminal">Terminal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Mode used when creating new tasks
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Shell</Label>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">Default shell</span>
                <Input
                  className="w-48"
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
              <p className="text-xs text-muted-foreground">
                Leave empty to use system default
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Flags</Label>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">Default Claude flags</span>
                <Input
                  className="w-72"
                  value={defaultClaudeFlags}
                  onChange={(e) => setDefaultClaudeFlags(e.target.value)}
                  onBlur={() => window.api.settings.set('default_claude_flags', defaultClaudeFlags.trim())}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">Default Codex flags</span>
                <Input
                  className="w-72"
                  value={defaultCodexFlags}
                  onChange={(e) => setDefaultCodexFlags(e.target.value)}
                  onBlur={() => window.api.settings.set('default_codex_flags', defaultCodexFlags.trim())}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Applied to new tasks only.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="diagnostics" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Logging</Label>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">Diagnostics enabled</span>
                <input
                  type="checkbox"
                  checked={diagnosticsConfig?.enabled ?? true}
                  onChange={(e) => {
                    updateDiagnosticsConfig({ enabled: e.target.checked })
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">Verbose logging</span>
                <input
                  type="checkbox"
                  checked={diagnosticsConfig?.verbose ?? false}
                  onChange={(e) => {
                    updateDiagnosticsConfig({ verbose: e.target.checked })
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">Include PTY output content</span>
                <input
                  type="checkbox"
                  checked={diagnosticsConfig?.includePtyOutput ?? false}
                  onChange={(e) => {
                    updateDiagnosticsConfig({ includePtyOutput: e.target.checked })
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">Retention days</span>
                <Input
                  className="w-24"
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
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">Time range</span>
                <Select value={exportRange} onValueChange={(v) => setExportRange(v as typeof exportRange)}>
                  <SelectTrigger className="w-48">
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
          </TabsContent>

          <TabsContent value="tags" className="space-y-4 pt-4">
            <div className="space-y-4">
              <Label className="text-base font-semibold">Tags</Label>

              {/* Existing tags */}
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

              {/* Add new tag */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="new-tag" className="text-xs">
                    New tag
                  </Label>
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
          </TabsContent>

          <TabsContent value="about" className="space-y-4 pt-4">
            {/* Database Path Section */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Database</Label>
              <div className="text-sm text-muted-foreground">
                <p>Location: {dbPath}</p>
                <p className="text-xs mt-1">
                  Database path can be changed via command line. Restart required.
                </p>
              </div>
            </div>

            {/* Claude Code Status Section */}
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
