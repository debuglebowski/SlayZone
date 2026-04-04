import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { Button, cn } from '@slayzone/ui'
import { getSkillValidation } from './skill-validation'
import type { AiConfigItem } from '../shared'

interface SkillListViewProps {
  items: AiConfigItem[]
  selectedSkillId: string | null
  onSelectSkill: (id: string | null) => void
  onDeleteItem: (id: string) => void
  onCreateSkill: () => void
}

export function SkillListView({
  items,
  selectedSkillId,
  onSelectSkill,
  onDeleteItem,
  onCreateSkill,
}: SkillListViewProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{items.length} skill{items.length !== 1 ? 's' : ''}</p>
        <Button size="sm" variant="outline" onClick={onCreateSkill} className="h-7">
          <Plus className="size-3 mr-1" />
          New Skill
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground py-8 text-center">
          No skills yet. Create one to get started.
        </p>
      )}

      <div className="space-y-1">
        {items.map((item) => {
          const validation = getSkillValidation(item)
          const isSelected = selectedSkillId === item.id
          const hasIssues = validation && validation.status !== 'valid'

          return (
            <div
              key={item.id}
              onClick={() => onSelectSkill(isSelected ? null : item.id)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                isSelected
                  ? 'ring-1 ring-primary border-primary/50 bg-surface-1'
                  : 'hover:bg-surface-1'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{item.slug}</span>
                  {hasIssues && (
                    <AlertTriangle className={cn(
                      'size-3 shrink-0',
                      validation.status === 'invalid' ? 'text-destructive' : 'text-amber-500'
                    )} />
                  )}
                </div>
                {item.name !== item.slug && (
                  <p className="text-xs text-muted-foreground truncate">{item.name}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id) }}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
