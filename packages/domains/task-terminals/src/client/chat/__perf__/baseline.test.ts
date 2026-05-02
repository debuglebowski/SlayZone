/**
 * Phase 0 perf baseline test.
 *
 * Run via:   pnpm test:chat:perf
 * Update via: pnpm test:chat:perf -- --update
 *
 * Reads __perf__/baseline.json. For each fixture:
 *   - Replays through the reducer.
 *   - Compares longest + p99 + total reducer ms against committed baseline.
 *   - Fails if any metric regresses by more than REGRESSION_BUDGET (default 25%).
 *
 * On `--update`, writes the current run to baseline.json instead of comparing.
 *
 * Phase 6 will wire this into CI with a stricter budget (15%).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { replayAllBestOf, type ReplayMetrics } from './replay'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BASELINE_PATH = join(__dirname, 'baseline.json')
const REGRESSION_BUDGET = 0.25
/** Skip regression checks for metrics measured below this absolute threshold — sub-ms noise dominates. */
const MIN_ABS_MS = 0.5

interface BaselineEntry {
  fixture: string
  events: number
  iterations: number
  finalTimelineLength: number
  longestReducerMs: number
  p99ReducerMs: number
  meanReducerMs: number
  totalReducerMs: number
}

function toEntry(m: ReplayMetrics): BaselineEntry {
  return {
    fixture: m.fixture,
    events: m.events,
    iterations: m.iterations,
    finalTimelineLength: m.finalTimelineLength,
    longestReducerMs: round(m.longestReducerMs),
    p99ReducerMs: round(m.p99ReducerMs),
    meanReducerMs: round(m.meanReducerMs),
    totalReducerMs: round(m.totalReducerMs),
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

function loadBaseline(): BaselineEntry[] | null {
  if (!existsSync(BASELINE_PATH)) return null
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as BaselineEntry[]
}

function writeBaseline(entries: BaselineEntry[]): void {
  writeFileSync(BASELINE_PATH, JSON.stringify(entries, null, 2) + '\n', 'utf8')
}

function main(): void {
  const update = process.argv.includes('--update')
  // 1000 iterations × best-of-5 runs after a warmup. Min-of-N + warmup gives
  // tight, repeatable totals while still representing real reducer cost.
  const metrics = replayAllBestOf(5, { iterations: 1000, trimSlowestPct: 0.01 })
  const current = metrics.map(toEntry)

  console.log('\n  Replay metrics (1000 iterations × best-of-5, trimmed 1%):')
  for (const m of metrics) {
    console.log(
      `  ${m.fixture.padEnd(22)} events=${String(m.events).padStart(4)}  ` +
        `tl=${String(m.finalTimelineLength).padStart(3)}  ` +
        `total=${m.totalReducerMs.toFixed(2)}ms  ` +
        `longest=${m.longestReducerMs.toFixed(4)}ms  ` +
        `p99=${m.p99ReducerMs.toFixed(4)}ms  ` +
        `mean=${m.meanReducerMs.toFixed(4)}ms`,
    )
  }

  if (update) {
    writeBaseline(current)
    console.log(`\n  ✓ Wrote baseline to ${BASELINE_PATH}`)
    return
  }

  const baseline = loadBaseline()
  if (!baseline) {
    writeBaseline(current)
    console.log(`\n  ✓ No baseline found — initialized at ${BASELINE_PATH}`)
    return
  }

  let failed = 0
  console.log('\n  Compared to baseline:')
  for (const cur of current) {
    const base = baseline.find((b) => b.fixture === cur.fixture)
    if (!base) {
      console.log(`  + ${cur.fixture} (new — no baseline entry)`)
      continue
    }
    const checks: Array<{ key: keyof BaselineEntry; label: string }> = [
      { key: 'totalReducerMs', label: 'total' },
      { key: 'meanReducerMs', label: 'mean' },
      { key: 'p99ReducerMs', label: 'p99' },
    ]
    for (const { key, label } of checks) {
      const baseVal = base[key] as number
      const curVal = cur[key] as number
      if (baseVal === 0) continue
      const delta = (curVal - baseVal) / baseVal
      const skipped = baseVal < MIN_ABS_MS && curVal < MIN_ABS_MS
      const flag = skipped ? '·' : delta > REGRESSION_BUDGET ? '✗' : '✓'
      if (!skipped && delta > REGRESSION_BUDGET) failed++
      console.log(
        `  ${flag} ${cur.fixture.padEnd(22)} ${label.padEnd(8)} ` +
          `${baseVal.toFixed(4)}ms → ${curVal.toFixed(4)}ms ` +
          `(${(delta * 100).toFixed(1)}%)${skipped ? ' [sub-threshold]' : ''}`,
      )
    }
    if (cur.finalTimelineLength !== base.finalTimelineLength) {
      console.log(
        `  ! ${cur.fixture.padEnd(22)} timeline length changed: ${base.finalTimelineLength} → ${cur.finalTimelineLength}`,
      )
    }
  }

  if (failed > 0) {
    console.error(`\n  ✗ ${failed} metric(s) regressed beyond ${REGRESSION_BUDGET * 100}% budget`)
    process.exit(1)
  }
  console.log('\n  ✓ All metrics within budget')
}

main()
