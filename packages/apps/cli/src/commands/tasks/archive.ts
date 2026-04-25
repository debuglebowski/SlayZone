import { openDb } from '../../db'
import { apiPost } from '../../api'

export async function archiveAction(idPrefix: string): Promise<void> {
  const db = openDb()

  const tasks = db.query<{ id: string; title: string }>(
    `SELECT id, title FROM tasks WHERE id LIKE :prefix || '%' AND archived_at IS NULL LIMIT 2`,
    { ':prefix': idPrefix }
  )

  if (tasks.length === 0) { console.error(`Task not found: ${idPrefix}`); process.exit(1) }
  if (tasks.length > 1) {
    console.error(`Ambiguous id prefix "${idPrefix}". Matches: ${tasks.map((t) => t.id.slice(0, 8)).join(', ')}`)
    process.exit(1)
  }

  const task = tasks[0]
  db.close()

  await apiPost<{ ok: boolean; data: { id: string; title: string } }>(`/api/tasks/${task.id}/archive`, {})
  console.log(`Archived: ${task.id.slice(0, 8)}  ${task.title}`)
}
