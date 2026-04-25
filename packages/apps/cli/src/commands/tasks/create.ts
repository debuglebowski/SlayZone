import { openDb, resolveProject, resolveProjectArg } from '../../db'
import { apiPost } from '../../api'
import { resolveStatusId } from '@slayzone/projects/shared'
import type { Task } from '@slayzone/task/shared/types'
import { getProjectColumnsConfig, resolveTaskTemplate } from './_shared'

export interface CreateOpts {
  project?: string
  description?: string
  status?: string
  priority?: string
  due?: string
  template?: string
  externalId?: string
  externalProvider?: string
}

export async function createAction(title: string, opts: CreateOpts): Promise<void> {
  const db = openDb()
  const project = resolveProject(db, resolveProjectArg(opts.project))

  if (opts.externalId) {
    const existing = db.query<{ id: string; title: string; status: string }>(
      `SELECT id, title, status FROM tasks
       WHERE project_id = :projectId AND external_provider = :provider AND external_id = :externalId
       LIMIT 1`,
      { ':projectId': project.id, ':provider': opts.externalProvider ?? null, ':externalId': opts.externalId }
    )
    if (existing.length > 0) {
      const t = existing[0]
      db.close()
      console.log(`Exists: ${t.id.slice(0, 8)}  ${t.title}  [${t.status}]  ${project.name}`)
      return
    }
  }

  const template = opts.template ? resolveTaskTemplate(db, project.id, opts.template) : null

  if (opts.priority) {
    const p = parseInt(opts.priority, 10)
    if (isNaN(p) || p < 1 || p > 5) { console.error('Priority must be 1-5.'); process.exit(1) }
  }

  let resolvedStatus: string | undefined
  if (opts.status) {
    const cols = getProjectColumnsConfig(db, project.id)
    const sid = resolveStatusId(opts.status, cols)
    if (!sid) {
      console.error(`Unknown status "${opts.status}" for project "${project.name}".`)
      process.exit(1)
    }
    resolvedStatus = sid
  }

  db.close()

  const { data: task } = await apiPost<{ ok: true; data: Task }>('/api/tasks', {
    projectId: project.id,
    title,
    description: opts.description,
    status: resolvedStatus,
    priority: opts.priority ? parseInt(opts.priority, 10) : undefined,
    dueDate: opts.due,
    templateId: template?.id,
  })

  if (opts.externalId) {
    const db2 = openDb()
    db2.run(
      `UPDATE tasks SET external_id = :eid, external_provider = :prov WHERE id = :id`,
      { ':eid': opts.externalId, ':prov': opts.externalProvider ?? null, ':id': task.id }
    )
    db2.close()
  }

  console.log(`Created: ${task.id.slice(0, 8)}  ${title}  [${task.status}]  ${project.name}`)
}
