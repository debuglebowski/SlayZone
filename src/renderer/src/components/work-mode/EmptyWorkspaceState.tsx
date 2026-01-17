import { MessageSquare, Globe, FileText, Lightbulb } from 'lucide-react'
import type { WorkspaceItemType } from '../../../../shared/types/database'

interface Props {
  onAddItem: (type: WorkspaceItemType) => void
}

export function EmptyWorkspaceState({ onAddItem }: Props) {
  const options = [
    { type: 'chat' as const, icon: MessageSquare, label: 'Chat', desc: 'AI conversation' },
    { type: 'browser' as const, icon: Globe, label: 'Browser', desc: 'Web research' },
    { type: 'document' as const, icon: FileText, label: 'Document', desc: 'Notes & drafts' },
    { type: 'dumper' as const, icon: Lightbulb, label: 'Dumper', desc: 'Organize thoughts' }
  ]

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex gap-6">
        {options.map(({ type, icon: Icon, label, desc }) => (
          <button
            key={type}
            onClick={() => onAddItem(type)}
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-dashed
                       hover:border-primary hover:bg-muted/50 transition-colors w-32"
          >
            <Icon className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <div className="font-medium">{label}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
