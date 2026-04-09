import type { TaskSummary } from '../shared/types'
import { formatTokens } from './chart-theme'

interface Props {
  data: TaskSummary[]
  onTaskClick?: (taskId: string) => void
}

export function TopTasksTable({ data, onTaskClick }: Props) {
  const sorted = [...data].sort((a, b) => b.totalTokens - a.totalTokens)

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border bg-surface-2 p-4">
        <p className="text-sm font-medium text-muted-foreground mb-3">Top Tasks by Tokens</p>
        <p className="text-sm text-muted-foreground">No task data — usage will be attributed once sessions match task IDs.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-lg border bg-surface-2 p-4">
      <p className="text-sm font-medium text-muted-foreground mb-3">Top Tasks by Tokens</p>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Task</th>
              <th className="pb-2 font-medium text-right">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => (
              <tr
                key={task.taskId}
                className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onTaskClick?.(task.taskId)}
              >
                <td className="py-2 pr-4 max-w-[300px] truncate">{task.taskTitle}</td>
                <td className="py-2 text-right font-medium tabular-nums">{formatTokens(task.totalTokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
