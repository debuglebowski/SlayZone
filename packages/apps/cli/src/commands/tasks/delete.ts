import { openDb } from '../../db'
import { apiDelete } from '../../api'

type DeleteTaskOutput = boolean | { blocked: true; reason: 'linked_to_provider' }

export async function deleteAction(idPrefix: string): Promise<void> {
  const db = openDb()

  const tasks = db.query<{ id: string; title: string }>(
    `SELECT id, title FROM tasks WHERE id LIKE :prefix || '%' LIMIT 2`,
    { ':prefix': idPrefix }
  )

  if (tasks.length === 0) { console.error(`Task not found: ${idPrefix}`); process.exit(1) }
  if (tasks.length > 1) {
    console.error(`Ambiguous id prefix "${idPrefix}". Matches: ${tasks.map((t) => t.id.slice(0, 8)).join(', ')}`)
    process.exit(1)
  }

  const task = tasks[0]
  db.close()

  const { data } = await apiDelete<{ ok: true; data: DeleteTaskOutput }>(`/api/tasks/${task.id}`)

  if (typeof data === 'object' && data.blocked) {
    console.error(`Cannot delete: linked to external provider. Unlink first.`)
    process.exit(1)
  }

  console.log(`Deleted: ${task.id.slice(0, 8)}  ${task.title}`)
}
