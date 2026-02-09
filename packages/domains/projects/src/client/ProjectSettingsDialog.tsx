import { useState, useEffect } from 'react'
import { FolderOpen } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@slayzone/ui'
import { SettingsLayout } from '@slayzone/ui'
import { Button } from '@slayzone/ui'
import { Input } from '@slayzone/ui'
import { Label } from '@slayzone/ui'
import { ColorPicker } from '@slayzone/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@slayzone/ui'
import { Checkbox } from '@slayzone/ui'
import { ContextManagerSettings } from '../../../ai-config/src/client/ContextManagerSettings'
import type { Project } from '@slayzone/projects/shared'
import type {
  IntegrationConnectionPublic,
  IntegrationProjectMapping,
  IntegrationSyncMode,
  LinearIssueSummary,
  LinearProject,
  LinearTeam
} from '@slayzone/integrations/shared'

interface ProjectSettingsDialogProps {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (project: Project) => void
}

export function ProjectSettingsDialog({
  project,
  open,
  onOpenChange,
  onUpdated
}: ProjectSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'ai-config'>('general')
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [path, setPath] = useState('')
  const [autoCreateWorktreeOverride, setAutoCreateWorktreeOverride] = useState<'inherit' | 'on' | 'off'>('inherit')
  const [loading, setLoading] = useState(false)
  const [connections, setConnections] = useState<IntegrationConnectionPublic[]>([])
  const [teams, setTeams] = useState<LinearTeam[]>([])
  const [linearProjects, setLinearProjects] = useState<LinearProject[]>([])
  const [mapping, setMapping] = useState<IntegrationProjectMapping | null>(null)
  const [connectionId, setConnectionId] = useState<string>('')
  const [teamId, setTeamId] = useState<string>('')
  const [teamKey, setTeamKey] = useState<string>('')
  const [linearProjectId, setLinearProjectId] = useState<string>('')
  const [syncMode, setSyncMode] = useState<IntegrationSyncMode>('one_way')
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [issueOptions, setIssueOptions] = useState<LinearIssueSummary[]>([])
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set())
  const [loadingIssues, setLoadingIssues] = useState(false)

  useEffect(() => {
    if (project) {
      setName(project.name)
      setColor(project.color)
      setPath(project.path || '')
      setAutoCreateWorktreeOverride(
        project.auto_create_worktree_on_task_create === 1
          ? 'on'
          : project.auto_create_worktree_on_task_create === 0
            ? 'off'
            : 'inherit'
      )
    }
  }, [project])

  useEffect(() => {
    if (open) setActiveTab('general')
  }, [open, project?.id])

  useEffect(() => {
    const loadIntegrationState = async () => {
      if (!open || !project) return
      const [loadedConnections, loadedMapping] = await Promise.all([
        window.api.integrations.listConnections('linear'),
        window.api.integrations.getProjectMapping(project.id, 'linear')
      ])
      setConnections(loadedConnections)
      setMapping(loadedMapping)
      setConnectionId(loadedMapping?.connection_id ?? loadedConnections[0]?.id ?? '')
      setTeamId(loadedMapping?.external_team_id ?? '')
      setTeamKey(loadedMapping?.external_team_key ?? '')
      setLinearProjectId(loadedMapping?.external_project_id ?? '')
      setSyncMode(loadedMapping?.sync_mode ?? 'one_way')
      setIssueOptions([])
      setSelectedIssueIds(new Set())
      setImportMessage('')
    }
    void loadIntegrationState()
  }, [open, project?.id])

  useEffect(() => {
    const loadTeams = async () => {
      if (!connectionId) {
        setTeams([])
        return
      }
      const loadedTeams = await window.api.integrations.listLinearTeams(connectionId)
      setTeams(loadedTeams)
      if (!teamId && loadedTeams[0]) {
        setTeamId(loadedTeams[0].id)
        setTeamKey(loadedTeams[0].key)
      }
    }
    void loadTeams()
  }, [connectionId])

  useEffect(() => {
    const loadLinearProjects = async () => {
      if (!connectionId || !teamId) {
        setLinearProjects([])
        return
      }
      const loaded = await window.api.integrations.listLinearProjects(connectionId, teamId)
      setLinearProjects(loaded)
    }
    void loadLinearProjects()
  }, [connectionId, teamId])

  const handleBrowse = async () => {
    const result = await window.api.dialog.showOpenDialog({
      title: 'Select Project Directory',
      defaultPath: path || undefined,
      properties: ['openDirectory']
    })
    if (!result.canceled && result.filePaths[0]) {
      setPath(result.filePaths[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!project || !name.trim()) return

    setLoading(true)
    try {
      const updated = await window.api.db.updateProject({
        id: project.id,
        name: name.trim(),
        color,
        path: path || null,
        autoCreateWorktreeOnTaskCreate:
          autoCreateWorktreeOverride === 'inherit'
            ? null
            : autoCreateWorktreeOverride === 'on'
      })

      if (connectionId && teamId) {
        const team = teams.find((t) => t.id === teamId)
        await window.api.integrations.setProjectMapping({
          projectId: project.id,
          provider: 'linear',
          connectionId,
          externalTeamId: teamId,
          externalTeamKey: team?.key ?? teamKey,
          externalProjectId: linearProjectId || null,
          syncMode
        })
      }

      onUpdated(updated)
    } finally {
      setLoading(false)
    }
  }

  const handleImportIssues = async () => {
    if (!project || !connectionId) return
    setImporting(true)
    setImportMessage('')
    try {
      const result = await window.api.integrations.importLinearIssues({
        projectId: project.id,
        connectionId,
        teamId: teamId || undefined,
        linearProjectId: linearProjectId || undefined,
        selectedIssueIds: selectedIssueIds.size > 0 ? [...selectedIssueIds] : undefined,
        limit: 50
      })
      setImportMessage(`Imported ${result.imported} issues`)
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  const handleLoadIssues = async () => {
    if (!connectionId) return
    setLoadingIssues(true)
    setImportMessage('')
    try {
      const result = await window.api.integrations.listLinearIssues({
        connectionId,
        projectId: project?.id,
        teamId: teamId || undefined,
        linearProjectId: linearProjectId || undefined,
        limit: 50
      })
      setIssueOptions(result.issues)
      setSelectedIssueIds(new Set())
      if (result.issues.length === 0) {
        setImportMessage('No matching Linear issues found')
      }
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingIssues(false)
    }
  }

  const toggleIssue = (issueId: string, checked: boolean) => {
    const next = new Set(selectedIssueIds)
    if (checked) next.add(issueId)
    else next.delete(issueId)
    setSelectedIssueIds(next)
  }

  const navItems: Array<{ key: typeof activeTab; label: string }> = [
    { key: 'general', label: 'General' },
    { key: 'ai-config', label: 'Project Context Manager' }
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="project-settings" className="overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Project Settings</DialogTitle>
        </DialogHeader>
        <SettingsLayout
          items={navItems}
          activeKey={activeTab}
          onSelect={(key) => setActiveTab(key as typeof activeTab)}
        >
          {activeTab === 'general' && (
            <div className="mx-auto w-full max-w-4xl">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-path">Repository Path</Label>
                  <div className="flex gap-2">
                    <Input
                      id="edit-path"
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      placeholder="/path/to/repo"
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={handleBrowse}>
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Claude Code terminal will open in this directory</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="auto-create-worktree-override">Auto-create worktree on task creation</Label>
                  <Select
                    value={autoCreateWorktreeOverride}
                    onValueChange={(value) => setAutoCreateWorktreeOverride(value as typeof autoCreateWorktreeOverride)}
                  >
                    <SelectTrigger id="auto-create-worktree-override" className="max-w-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">Use global setting</SelectItem>
                      <SelectItem value="on">Always on</SelectItem>
                      <SelectItem value="off">Always off</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Overrides the global Git setting for this project only.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>Color</Label>
                  <ColorPicker value={color} onChange={setColor} />
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Linear Mapping</Label>
                  {connections.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Connect Linear in Settings to enable project mapping.
                    </p>
                  ) : (
                    <div className="space-y-2 rounded border p-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Connection</Label>
                        <Select value={connectionId} onValueChange={setConnectionId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select connection" />
                          </SelectTrigger>
                          <SelectContent>
                            {connections.map((connection) => (
                              <SelectItem key={connection.id} value={connection.id}>
                                {connection.workspace_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Team</Label>
                        <Select
                          value={teamId}
                          onValueChange={(value) => {
                            setTeamId(value)
                            const team = teams.find((t) => t.id === value)
                            setTeamKey(team?.key ?? '')
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select team" />
                          </SelectTrigger>
                          <SelectContent>
                            {teams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.key} - {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Project (optional)</Label>
                        <Select value={linearProjectId || '__none__'} onValueChange={(value) => setLinearProjectId(value === '__none__' ? '' : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Any project in team" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Any project in team</SelectItem>
                            {linearProjects.map((lp) => (
                              <SelectItem key={lp.id} value={lp.id}>
                                {lp.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Sync mode</Label>
                        <Select value={syncMode} onValueChange={(value) => setSyncMode(value as IntegrationSyncMode)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="two_way">Two-way</SelectItem>
                            <SelectItem value="one_way">One-way (Linear → SlayZone)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {mapping ? (
                        <p className="text-xs text-muted-foreground">
                          Current mapping: {mapping.external_team_key} ({mapping.sync_mode === 'two_way' ? 'two-way' : 'one-way'})
                        </p>
                      ) : null}
                      <div className="pt-1">
                        <div className="mb-2 flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!connectionId || loadingIssues}
                            onClick={handleLoadIssues}
                          >
                            {loadingIssues ? 'Loading…' : 'Load issues'}
                          </Button>
                          {issueOptions.length > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (selectedIssueIds.size === issueOptions.length) {
                                  setSelectedIssueIds(new Set())
                                  return
                                }
                                setSelectedIssueIds(new Set(issueOptions.map((i) => i.id)))
                              }}
                            >
                              {selectedIssueIds.size === issueOptions.length ? 'Clear selection' : 'Select all'}
                            </Button>
                          ) : null}
                        </div>
                        {issueOptions.length > 0 ? (
                          <div className="max-h-44 space-y-1 overflow-y-auto rounded border p-2">
                            {issueOptions.map((issue) => (
                              <label key={issue.id} className="flex cursor-pointer items-start gap-2 text-xs">
                                <Checkbox
                                  checked={selectedIssueIds.has(issue.id)}
                                  onCheckedChange={(checked) => toggleIssue(issue.id, checked === true)}
                                />
                                <span className="min-w-0">
                                  <span className="font-medium">{issue.identifier}</span>
                                  {' - '}
                                  <span className="text-muted-foreground">{issue.title}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!connectionId || importing}
                          onClick={handleImportIssues}
                        >
                          {importing
                            ? 'Importing…'
                            : selectedIssueIds.size > 0
                              ? `Import selected (${selectedIssueIds.size})`
                              : 'Import from Linear'}
                        </Button>
                        {importMessage ? (
                          <p className="pt-1 text-xs text-muted-foreground">{importMessage}</p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!name.trim() || loading}>
                    Save
                  </Button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'ai-config' && (
            <ContextManagerSettings
              scope="project"
              projectId={project?.id ?? null}
              projectPath={project?.path}
              projectName={project?.name}
            />
          )}
        </SettingsLayout>
      </DialogContent>
    </Dialog>
  )
}
