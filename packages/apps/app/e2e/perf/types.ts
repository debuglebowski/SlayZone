/**
 * Shared types for the perf harness. Kept in their own file so the report
 * generator (which runs as a plain CLI without Playwright) can import them.
 */

export interface ProfilerCommit {
  id: string
  phase: 'mount' | 'update' | 'nested-update'
  actualDuration: number
  baseDuration: number
  startTime: number
  commitTime: number
}

export interface PerfMark {
  name: string
  startTime: number
}

export interface PerfMeasure {
  name: string
  startTime: number
  duration: number
}

export interface LongTaskEntry {
  startTime: number
  duration: number
}

export interface IpcCallSummary {
  channel: string
  count: number
  totalMs: number
  maxMs: number
}

export interface CdpPerfSnapshot {
  jsHeapUsedMB: number
  domNodes: number
  jsEventListeners: number
  layoutCount: number
  recalcStyleCount: number
  layoutDurationMs: number
  recalcStyleDurationMs: number
  scriptDurationMs: number
  taskDurationMs: number
}

export interface IterationResult {
  index: number
  wallMs: number
  marks: PerfMark[]
  measures: PerfMeasure[]
  longTasks: LongTaskEntry[]
  longTaskTotalMs: number
  profilerCommits: ProfilerCommit[]
  ipcCalls: IpcCallSummary[]
  ipcTotal: { count: number; totalMs: number }
  heapBeforeMB: number
  heapAfterMB: number
  cdpBefore: CdpPerfSnapshot
  cdpAfter: CdpPerfSnapshot
  cpuProfilePath: string | null
}

export interface ScenarioResult {
  name: string
  description: string
  iterations: number
  warmupDropped: number
  startedAt: string
  durationMs: number
  runs: IterationResult[]
  summary: {
    wallP50: number
    wallP95: number
    wallMax: number
    longTaskP95: number
    profilerActualP95: number
    ipcCountP50: number
  }
}
