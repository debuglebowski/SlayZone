import type { IpcMain } from 'electron'
import type { Database } from 'better-sqlite3'
import type { Automation, AutomationEvent, AutomationRow, AutomationRun } from '@slayzone/automations/shared'
import { parseAutomationRow } from '@slayzone/automations/shared'
import { resolveTemplate, type TemplateContext } from '@slayzone/automations/shared'
import { exec } from 'child_process'

const MAX_DEPTH = 5
const ACTION_TIMEOUT_MS = 30_000
const MAX_RUNS_PER_AUTOMATION = 100

export class AutomationEngine {
  private ipcMain: IpcMain | null = null
  // Tracks current execution depth for synchronous cascading via ipcMain.emit
  private currentDepth = 0

  constructor(
    private db: Database,
    private notifyRenderer: () => void
  ) {}

  start(ipcMain: IpcMain): void {
    this.ipcMain = ipcMain

    ipcMain.on('db:tasks:update:done', (_event, taskId: string, meta?: { oldStatus?: string }) => {
      const task = this.db.prepare('SELECT id, project_id, status FROM tasks WHERE id = ?').get(taskId) as {
        id: string; project_id: string; status: string
      } | undefined
      if (!task) return

      // Only fire if status actually changed
      if (meta?.oldStatus === undefined || meta.oldStatus === task.status) return

      this.handleEvent({
        type: 'task_status_change',
        taskId: task.id,
        projectId: task.project_id,
        oldStatus: meta.oldStatus,
        newStatus: task.status,
        depth: this.currentDepth,
      })
    })
  }

  private handleEvent(event: AutomationEvent): void {
    const depth = event.depth ?? 0
    if (depth >= MAX_DEPTH) return
    if (!event.projectId) return

    const rows = this.db.prepare(
      'SELECT * FROM automations WHERE project_id = ? AND enabled = 1'
    ).all(event.projectId) as AutomationRow[]

    const automations = rows.map(parseAutomationRow)

    for (const automation of automations) {
      if (this.matchesTrigger(automation, event)) {
        if (this.evaluateConditions(automation, event)) {
          void this.executeAutomation(automation, event, depth)
        }
      }
    }
  }

  private matchesTrigger(automation: Automation, event: AutomationEvent): boolean {
    const trigger = automation.trigger_config
    if (trigger.type !== event.type) return false

    if (trigger.type === 'task_status_change') {
      const { fromStatus, toStatus } = trigger.params as { fromStatus?: string; toStatus?: string }
      if (fromStatus && event.oldStatus !== fromStatus) return false
      if (toStatus && event.newStatus !== toStatus) return false
      return true
    }

    return false
  }

  private evaluateConditions(automation: Automation, event: AutomationEvent): boolean {
    for (const condition of automation.conditions) {
      if (condition.type === 'task_property' && event.taskId) {
        const task = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(event.taskId) as Record<string, unknown> | undefined
        if (!task) return false

        const { field, operator, value } = condition.params as { field: string; operator: string; value: unknown }
        const actual = task[field]

        switch (operator) {
          case 'equals': if (actual !== value) return false; break
          case 'not_equals': if (actual === value) return false; break
          case 'exists': if (actual == null || actual === '') return false; break
          case 'not_exists': if (actual != null && actual !== '') return false; break
          default: return false
        }
      }
    }
    return true
  }

  private async executeAutomation(automation: Automation, event: AutomationEvent, depth: number): Promise<void> {
    const runId = crypto.randomUUID()
    const startTime = Date.now()

    this.db.prepare(
      `INSERT INTO automation_runs (id, automation_id, trigger_event, status, started_at)
       VALUES (?, ?, ?, 'running', datetime('now'))`
    ).run(runId, automation.id, JSON.stringify(event))

    const ctx = this.buildTemplateContext(event)
    const prevDepth = this.currentDepth

    try {
      // Set depth so synchronous cascading events (via ipcMain.emit) see the correct level
      this.currentDepth = depth + 1
      for (const action of automation.actions) {
        await this.executeAction(action.type, action.params, ctx)
      }

      const durationMs = Date.now() - startTime
      this.db.prepare(
        `UPDATE automation_runs SET status = 'success', duration_ms = ?, completed_at = datetime('now') WHERE id = ?`
      ).run(durationMs, runId)
    } catch (err) {
      const durationMs = Date.now() - startTime
      this.db.prepare(
        `UPDATE automation_runs SET status = 'error', error = ?, duration_ms = ?, completed_at = datetime('now') WHERE id = ?`
      ).run(err instanceof Error ? err.message : String(err), durationMs, runId)
    } finally {
      this.currentDepth = prevDepth
    }

    // Update run_count + last_run_at
    this.db.prepare(
      `UPDATE automations SET run_count = run_count + 1, last_run_at = datetime('now') WHERE id = ?`
    ).run(automation.id)

    this.pruneOldRuns(automation.id)
    this.notifyRenderer()
  }

  private async executeAction(type: string, params: Record<string, unknown>, ctx: TemplateContext): Promise<void> {
    switch (type) {
      case 'run_command': {
        const command = resolveTemplate(params.command as string, ctx)
        const cwd = params.cwd ? resolveTemplate(params.cwd as string, ctx) : ctx.project?.path
        await this.runCommand(command, cwd)
        break
      }
      case 'change_task_status': {
        const taskId = ctx.task?.id
        const newStatus = params.status as string
        if (!taskId || !newStatus) throw new Error('Missing task or status for change_task_status action')

        // Go through the normal IPC update path so all side effects fire
        // (integration pushes, onMutation, etc.)
        if (this.ipcMain) {
          const oldTask = this.db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string } | undefined
          this.db.prepare("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, taskId)
          // Emit with incremented depth so cascading automations respect the limit
          this.ipcMain.emit('db:tasks:update:done', null as unknown as Electron.Event, taskId, { oldStatus: oldTask?.status })
        }
        break
      }
      default:
        throw new Error(`Unknown action type: ${type}`)
    }
  }

  private runCommand(command: string, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = exec(command, { cwd, timeout: ACTION_TIMEOUT_MS }, (err, stdout, stderr) => {
        if (err) reject(new Error(`Command failed: ${err.message}\n${stderr}`))
        else resolve(stdout)
      })
      // Ensure cleanup
      setTimeout(() => child.kill(), ACTION_TIMEOUT_MS + 1000)
    })
  }

  private buildTemplateContext(event: AutomationEvent): TemplateContext {
    const ctx: TemplateContext = {
      trigger: {
        old_status: event.oldStatus,
        new_status: event.newStatus,
      }
    }

    if (event.taskId) {
      const task = this.db.prepare('SELECT id, title AS name, status, priority, worktree_path, worktree_parent_branch AS branch, project_id FROM tasks WHERE id = ?').get(event.taskId) as {
        id: string; name: string; status: string; priority: number; worktree_path: string | null; branch: string | null; project_id: string
      } | undefined
      if (task) {
        ctx.task = { id: task.id, name: task.name, status: task.status, priority: task.priority, worktree_path: task.worktree_path, branch: task.branch }
      }
    }

    if (event.projectId) {
      const project = this.db.prepare('SELECT id, name, path FROM projects WHERE id = ?').get(event.projectId) as {
        id: string; name: string; path: string
      } | undefined
      if (project) {
        ctx.project = { id: project.id, name: project.name, path: project.path }
      }
    }

    return ctx
  }

  private pruneOldRuns(automationId: string): void {
    this.db.prepare(
      `DELETE FROM automation_runs WHERE automation_id = ? AND id NOT IN (
        SELECT id FROM automation_runs WHERE automation_id = ? ORDER BY started_at DESC LIMIT ?
      )`
    ).run(automationId, automationId, MAX_RUNS_PER_AUTOMATION)
  }

  async executeManual(automationId: string): Promise<AutomationRun> {
    const row = this.db.prepare('SELECT * FROM automations WHERE id = ?').get(automationId) as AutomationRow | undefined
    if (!row) throw new Error('Automation not found')
    const automation = parseAutomationRow(row)

    const event: AutomationEvent = {
      type: 'manual',
      projectId: automation.project_id,
      automationId: automation.id,
      depth: 0,
    }

    const runId = crypto.randomUUID()
    const startTime = Date.now()

    this.db.prepare(
      `INSERT INTO automation_runs (id, automation_id, trigger_event, status, started_at)
       VALUES (?, ?, ?, 'running', datetime('now'))`
    ).run(runId, automation.id, JSON.stringify(event))

    const ctx = this.buildTemplateContext(event)
    const prevDepth = this.currentDepth

    try {
      this.currentDepth = 1
      for (const action of automation.actions) {
        await this.executeAction(action.type, action.params, ctx)
      }

      const durationMs = Date.now() - startTime
      this.db.prepare(
        `UPDATE automation_runs SET status = 'success', duration_ms = ?, completed_at = datetime('now') WHERE id = ?`
      ).run(durationMs, runId)
    } catch (err) {
      const durationMs = Date.now() - startTime
      this.db.prepare(
        `UPDATE automation_runs SET status = 'error', error = ?, duration_ms = ?, completed_at = datetime('now') WHERE id = ?`
      ).run(err instanceof Error ? err.message : String(err), durationMs, runId)
    } finally {
      this.currentDepth = prevDepth
    }

    this.db.prepare(
      `UPDATE automations SET run_count = run_count + 1, last_run_at = datetime('now') WHERE id = ?`
    ).run(automation.id)

    this.pruneOldRuns(automation.id)
    this.notifyRenderer()

    return this.db.prepare('SELECT * FROM automation_runs WHERE id = ?').get(runId) as AutomationRun
  }
}
