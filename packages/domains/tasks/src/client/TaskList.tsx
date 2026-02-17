import type { Task } from '@slayzone/task/shared'
import { TaskItem } from './TaskItem'

interface TaskListProps {
  tasks: Task[]
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

export function TaskList({ tasks, onEdit, onDelete }: TaskListProps): React.JSX.Element {
  if (tasks.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">No tasks yet</div>
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  )
}
