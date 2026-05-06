import { test, expect, getWorkerArtifactsDir } from '../fixtures/electron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = path.resolve(__dirname, '..', '..', '..', '..', '..', 'working-notes', 'performance')

interface BootStep {
  step: string
  t: number
  delta: number
  source: 'main' | 'renderer'
}

function parseBootLog(content: string): BootStep[] {
  const out: BootStep[] = []
  const re = /\[boot\] t=\s*(\d+)ms Δ=\s*(\d+)ms (.+)$/
  for (const line of content.split('\n')) {
    const m = line.match(re)
    if (!m) continue
    const step = m[3].trim()
    out.push({
      t: Number(m[1]),
      delta: Number(m[2]),
      step,
      source: step.startsWith('renderer:') ? 'renderer' : 'main',
    })
  }
  return out
}

test('profile main-process boot', async ({ electronApp, mainWindow }) => {
  // Force the fixture to instantiate. Wait briefly so the renderer's data-ready
  // mark + dumpBootSummary lands in stdout before we read it.
  expect(electronApp).toBeTruthy()
  await mainWindow.waitForSelector('#root', { timeout: 15_000 })
  // Give MCP server start + renderer dataReady a beat to flush.
  await new Promise((r) => setTimeout(r, 1500))

  const artifactsDir = getWorkerArtifactsDir()
  expect(artifactsDir, 'worker artifacts dir not exposed by fixture').toBeTruthy()

  const bootLogPath = path.join(artifactsDir!, 'launch-attempt-1', 'boot.log')
  expect(fs.existsSync(bootLogPath), `boot.log missing at ${bootLogPath}`).toBe(true)

  const content = fs.readFileSync(bootLogPath, 'utf8')
  const steps = parseBootLog(content)
  expect(steps.length, 'no [boot] lines parsed — SLAYZONE_DEBUG_BOOT not active?').toBeGreaterThan(5)

  const total = steps[steps.length - 1].t
  const sortedByDelta = [...steps].sort((a, b) => b.delta - a.delta)
  const top = sortedByDelta.slice(0, 15)

  console.log('\n=== MAIN-PROCESS BOOT TIMELINE ===')
  console.log('─'.repeat(80))
  for (const s of steps) {
    const tag = s.source === 'renderer' ? 'R' : 'M'
    console.log(`  [${tag}] t=${String(s.t).padStart(5)}ms Δ=${String(s.delta).padStart(5)}ms  ${s.step}`)
  }

  console.log('\n=== TOP 15 SLOWEST GAPS ===')
  console.log('─'.repeat(80))
  const maxDelta = Math.max(...top.map((s) => s.delta), 1)
  const barWidth = 40
  for (const s of top) {
    const len = Math.max(1, Math.round((s.delta / maxDelta) * barWidth))
    const bar = '█'.repeat(len)
    const tag = s.source === 'renderer' ? 'R' : 'M'
    console.log(`  Δ=${String(s.delta).padStart(5)}ms  t=${String(s.t).padStart(5)}ms  [${tag}]  ${bar.padEnd(barWidth)}  ${s.step}`)
  }
  console.log(`\n  Total to last marker: ${total}ms  (${steps.length} steps)\n`)

  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const outFile = path.join(RESULTS_DIR, 'main-boot-timeline.json')
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalMs: total,
        stepCount: steps.length,
        topGaps: top,
        steps,
      },
      null,
      2,
    ),
  )
  console.log(`📊 Results written to ${outFile}`)

  // Sanity bound — boot should complete under 10s on dev machine.
  expect(total).toBeLessThan(10_000)
})
