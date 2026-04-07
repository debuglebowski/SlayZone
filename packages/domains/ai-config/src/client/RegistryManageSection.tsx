import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react'
import { Button, Switch, cn } from '@slayzone/ui'
import type { SkillRegistry } from '../shared'

interface RegistryManageSectionProps {
  registries: SkillRegistry[]
  onToggle: (id: string, enabled: boolean) => void
  onRemove: (id: string) => void
  onRefresh: (id: string) => void
  refreshingId: string | null
}

export function RegistryManageSection({ registries, onToggle, onRemove, onRefresh, refreshingId }: RegistryManageSectionProps) {
  if (registries.length === 0) {
    return <p className="text-xs text-muted-foreground">No registries configured.</p>
  }

  return (
    <div className="space-y-2">
      {registries.map((reg) => (
        <div
          key={reg.id}
          className="flex items-center gap-3 rounded-lg border border-border/50 bg-background px-4 py-3"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{reg.name}</span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground">
                {reg.source_type}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
              {reg.github_owner && (
                <span>{reg.github_owner}/{reg.github_repo}</span>
              )}
              {reg.entry_count != null && (
                <span>{reg.entry_count} skills</span>
              )}
              {reg.last_synced_at && (
                <span>Synced {new Date(reg.last_synced_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={reg.enabled}
              onCheckedChange={(checked) => onToggle(reg.id, checked)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onRefresh(reg.id)}
              disabled={refreshingId === reg.id}
            >
              <RefreshCw className={cn('size-3.5', refreshingId === reg.id && 'animate-spin')} />
            </Button>
            {reg.source_type === 'github' && (
              <>
                <a
                  href={`https://github.com/${reg.github_owner}/${reg.github_repo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-red-500 hover:text-red-600"
                  onClick={() => onRemove(reg.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
