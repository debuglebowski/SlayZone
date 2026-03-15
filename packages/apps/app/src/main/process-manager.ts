import { spawn, execFile } from 'child_process'
import type { ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import type { Database } from 'better-sqlite3'

export type ProcessStatus = 'running' | 'stopped' | 'completed' | 'error'

export interface ProcessInfo {
  id: string
  taskId: string | null
  projectId: string | null
  label: string
  command: string
  cwd: string
  autoRestart: boolean
  status: ProcessStatus
  pid: number | null
  exitCode: number | null
  logBuffer: string[]
  startedAt: string
  restartCount: number
  spawnedAt: string | null
}

interface ManagedProcess extends ProcessInfo {
  child: ChildProcess | null
}

const LOG_BUFFER_MAX = 500

let win: BrowserWindow | null = null
let db: Database | null = null
const processes = new Map<string, ManagedProcess>()
const logSubscribers = new Map<string, Set<(line: string) => void>>()

export function subscribeToProcessLogs(id: string, cb: (line: string) => void): () => void {
  if (!logSubscribers.has(id)) logSubscribers.set(id, new Set())
  logSubscribers.get(id)!.add(cb)
  return () => logSubscribers.get(id)?.delete(cb)
}

export function setProcessManagerWindow(window: BrowserWindow): void {
  win = window
}

export function initProcessManager(database: Database): void {
  db = database
  const rows = db.prepare('SELECT * FROM processes ORDER BY created_at').all() as Array<{
    id: string; task_id: string | null; project_id: string | null; label: string; command: string; cwd: string; auto_restart: number
  }>
  for (const row of rows) {
    processes.set(row.id, {
      id: row.id,
      taskId: row.task_id,
      projectId: row.project_id,
      label: row.label,
      command: row.command,
      cwd: row.cwd,
      autoRestart: row.auto_restart === 1,
      status: 'stopped',
      pid: null,
      exitCode: null,
      logBuffer: [],
      child: null,
      startedAt: new Date().toISOString(),
      restartCount: 0,
      spawnedAt: null,
    })
  }
}

function pushLog(proc: ManagedProcess, line: string): void {
  proc.logBuffer.push(line)
  if (proc.logBuffer.length > LOG_BUFFER_MAX) proc.logBuffer.shift()
  win?.webContents.send('processes:log', proc.id, line)
  logSubscribers.get(proc.id)?.forEach((cb) => cb(line))
}

function setStatus(proc: ManagedProcess, status: ProcessStatus): void {
  proc.status = status
  win?.webContents.send('processes:status', proc.id, status)
}

function doSpawn(proc: ManagedProcess): void {
  proc.spawnedAt = new Date().toISOString()
  startStatsPolling()
  const child = spawn(proc.command, [], {
    cwd: proc.cwd,
    shell: true,
    env: { ...process.env }
  })

  proc.child = child
  proc.pid = child.pid ?? null
  proc.exitCode = null

  child.stdout?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n')) {
      if (line.trim()) pushLog(proc, line)
    }
  })

  child.stderr?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n')) {
      if (line.trim()) pushLog(proc, line)
    }
  })

  child.on('exit', (code) => {
    if (proc.child !== child) return // stale exit from restarted process
    proc.pid = null
    proc.child = null
    proc.exitCode = code
    if (proc.autoRestart && processes.has(proc.id)) {
      proc.restartCount++
      pushLog(proc, `[exited with code ${code ?? '?'}, restarting in 1s...]`)
      setStatus(proc, 'running')
      setTimeout(() => {
        if (processes.has(proc.id)) doSpawn(proc)
      }, 1000)
    } else {
      setStatus(proc, code === 0 ? 'completed' : 'error')
      maybeStopStatsPolling()
    }
  })
}

export function createProcess(
  projectId: string | null,
  taskId: string | null,
  label: string,
  command: string,
  cwd: string,
  autoRestart: boolean
): string {
  const id = randomUUID()
  const proc: ManagedProcess = {
    id, taskId, projectId, label, command, cwd, autoRestart,
    status: 'stopped', pid: null, exitCode: null,
    logBuffer: [], child: null,
    startedAt: new Date().toISOString(),
    restartCount: 0, spawnedAt: null,
  }
  processes.set(id, proc)
  db?.prepare('INSERT INTO processes (id, project_id, task_id, label, command, cwd, auto_restart) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, projectId, taskId, label, command, cwd, autoRestart ? 1 : 0)
  return id
}

export function spawnProcess(
  projectId: string | null,
  taskId: string | null,
  label: string,
  command: string,
  cwd: string,
  autoRestart: boolean
): string {
  const id = randomUUID()
  const proc: ManagedProcess = {
    id, taskId, projectId, label, command, cwd, autoRestart,
    status: 'running', pid: null, exitCode: null,
    logBuffer: [], child: null,
    startedAt: new Date().toISOString(),
    restartCount: 0, spawnedAt: null,
  }
  processes.set(id, proc)
  db?.prepare('INSERT INTO processes (id, project_id, task_id, label, command, cwd, auto_restart) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, projectId, taskId, label, command, cwd, autoRestart ? 1 : 0)
  doSpawn(proc)
  return id
}

export function updateProcess(
  id: string,
  updates: Partial<Pick<ProcessInfo, 'label' | 'command' | 'cwd' | 'autoRestart' | 'taskId' | 'projectId'>>
): boolean {
  const proc = processes.get(id)
  if (!proc) return false
  Object.assign(proc, updates)
  db?.prepare(`
    UPDATE processes SET
      project_id = ?, task_id = ?, label = ?, command = ?, cwd = ?, auto_restart = ?
    WHERE id = ?
  `).run(proc.projectId, proc.taskId, proc.label, proc.command, proc.cwd, proc.autoRestart ? 1 : 0, id)
  return true
}

export function stopProcess(id: string): boolean {
  const proc = processes.get(id)
  if (!proc) return false
  // Set child to null before kill so the exit handler's `proc.child !== child`
  // guard bails out (prevents auto-restart from firing)
  const child = proc.child
  proc.child = null
  proc.pid = null
  proc.spawnedAt = null
  child?.kill()
  setStatus(proc, 'stopped')
  maybeStopStatsPolling()
  return true
}

export function killProcess(id: string): boolean {
  const proc = processes.get(id)
  if (!proc) return false
  proc.autoRestart = false
  proc.child?.kill()
  proc.child = null
  processes.delete(id)
  db?.prepare('DELETE FROM processes WHERE id = ?').run(id)
  return true
}

export function restartProcess(id: string): boolean {
  const proc = processes.get(id)
  if (!proc) return false
  proc.child?.kill()
  proc.child = null
  proc.logBuffer.push('[restarting...]')
  setStatus(proc, 'running')
  setTimeout(() => doSpawn(proc), 500)
  return true
}

/** Kill all processes belonging to a specific task. Project-scoped processes are unaffected. */
export function killTaskProcesses(taskId: string): void {
  for (const [id, proc] of processes.entries()) {
    if (proc.taskId === taskId) killProcess(id)
  }
}

/** Returns task-scoped processes for taskId plus project-scoped processes matching projectId. */
export function listForTask(taskId: string | null, projectId: string | null): ProcessInfo[] {
  return Array.from(processes.values())
    .filter(p => p.taskId === taskId || (p.taskId === null && p.projectId != null && p.projectId === projectId))
    .map(({ child: _, ...info }) => info)
}

export function listAllProcesses(): ProcessInfo[] {
  return Array.from(processes.values()).map(({ child: _, ...info }) => info)
}

let statsInterval: ReturnType<typeof setInterval> | null = null

/** Resolve actual child PIDs (shell: true means proc.pid is the shell wrapper). */
function resolveChildPids(shellPids: number[], cb: (pidMap: Map<number, number[]>) => void): void {
  execFile('pgrep', ['-P', shellPids.join(',')], (err, stdout) => {
    const map = new Map<number, number[]>()
    if (err || !stdout.trim()) {
      // No children found — fall back to shell PIDs
      for (const pid of shellPids) map.set(pid, [pid])
      return cb(map)
    }
    // pgrep returns one PID per line; need to map child → parent via ps
    const childPids = stdout.trim().split('\n').map(s => s.trim()).filter(Boolean)
    execFile('ps', ['-o', 'pid=,ppid=', '-p', childPids.join(',')], (err2, stdout2) => {
      if (err2) {
        for (const pid of shellPids) map.set(pid, [pid])
        return cb(map)
      }
      for (const line of stdout2.trim().split('\n')) {
        const parts = line.trim().split(/\s+/)
        if (parts.length < 2) continue
        const [childStr, parentStr] = parts
        const parent = Number(parentStr)
        const child = Number(childStr)
        if (!map.has(parent)) map.set(parent, [])
        map.get(parent)!.push(child)
      }
      // Shell PIDs with no children resolved → fall back to self
      for (const pid of shellPids) {
        if (!map.has(pid)) map.set(pid, [pid])
      }
      cb(map)
    })
  })
}

function startStatsPolling(): void {
  if (statsInterval) return
  statsInterval = setInterval(() => {
    const running = Array.from(processes.values()).filter(p => p.pid != null)
    if (running.length === 0 || !win) return
    const shellPids = running.map(p => p.pid!)
    resolveChildPids(shellPids, (pidMap) => {
      const allPids = Array.from(new Set(Array.from(pidMap.values()).flat()))
      if (allPids.length === 0) return
      execFile('ps', ['-o', 'pid=,%cpu=,rss=', '-p', allPids.join(',')], (err, stdout) => {
        if (err || !win) return
        // Parse ps output into per-PID stats
        const pidStats = new Map<number, { cpu: number; rss: number }>()
        for (const line of stdout.trim().split('\n')) {
          const parts = line.trim().split(/\s+/)
          if (parts.length < 3) continue
          pidStats.set(Number(parts[0]), { cpu: parseFloat(parts[1]), rss: parseInt(parts[2], 10) })
        }
        // Aggregate child stats per managed process
        const stats: Record<string, { cpu: number; rss: number }> = {}
        for (const proc of running) {
          const children = pidMap.get(proc.pid!) ?? [proc.pid!]
          let cpu = 0, rss = 0
          for (const cpid of children) {
            const s = pidStats.get(cpid)
            if (s) { cpu += s.cpu; rss += s.rss }
          }
          stats[proc.id] = { cpu, rss }
        }
        if (Object.keys(stats).length > 0) {
          win?.webContents.send('processes:stats', stats)
        }
      })
    })
  }, 3000)
}

function stopStatsPolling(): void {
  if (statsInterval) { clearInterval(statsInterval); statsInterval = null }
}

function maybeStopStatsPolling(): void {
  const hasRunning = Array.from(processes.values()).some(p => p.pid != null)
  if (!hasRunning) stopStatsPolling()
}

export function killAllProcesses(): void {
  stopStatsPolling()
  for (const proc of processes.values()) {
    proc.autoRestart = false
    proc.child?.kill()
    proc.child = null
  }
  processes.clear()
}
