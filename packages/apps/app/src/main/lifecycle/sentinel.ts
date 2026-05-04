// Boot sentinel + crash-dump scanner.
//
// Two-file scheme: write `.clean-shutdown.boot` at startup, write `.clean-shutdown`
// when shutdown completes cleanly. On next boot:
//   - both present → previous run exited cleanly
//   - only stub present → previous run crashed or was force-killed
//   - neither → first ever launch (or files manually cleaned)
import { app } from 'electron'
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

interface BootStub {
  ts: number
  pid: number
  version: string
}

const stubFile = '.clean-shutdown.boot'
const cleanFile = '.clean-shutdown'

function stubPath(): string {
  return join(app.getPath('userData'), stubFile)
}

function cleanPath(): string {
  return join(app.getPath('userData'), cleanFile)
}

export interface PreviousBootResult {
  crashed: boolean
  prevBoot: BootStub | null
}

export function detectPreviousCrash(): PreviousBootResult {
  let prev: BootStub | null = null
  let crashed = false
  try {
    const raw = readFileSync(stubPath(), 'utf8')
    prev = JSON.parse(raw) as BootStub
    crashed = !existsSync(cleanPath())
  } catch {
    // No stub → fresh state. Not a crash.
  } finally {
    try { unlinkSync(stubPath()) } catch { /* ignore */ }
    try { unlinkSync(cleanPath()) } catch { /* ignore */ }
  }
  return { crashed, prevBoot: prev }
}

export function writeBootStub(): void {
  try {
    const stub: BootStub = { ts: Date.now(), pid: process.pid, version: app.getVersion() }
    writeFileSync(stubPath(), JSON.stringify(stub))
  } catch (err) {
    console.warn('[lifecycle] writeBootStub failed:', err)
  }
}

export function writeCleanShutdownSentinel(): void {
  try {
    writeFileSync(cleanPath(), String(Date.now()))
  } catch {
    // Best-effort. Failure here just means next boot flags as crash — acceptable.
  }
}

export interface MinidumpInfo {
  path: string
  size: number
  mtimeMs: number
}

export function scanCrashDumps(sinceMs: number): MinidumpInfo[] {
  let dir: string
  try {
    dir = app.getPath('crashDumps')
  } catch {
    return []
  }
  const out: MinidumpInfo[] = []
  try {
    const completed = join(dir, 'completed')
    const targetDir = existsSync(completed) ? completed : dir
    for (const name of readdirSync(targetDir)) {
      if (!name.endsWith('.dmp')) continue
      const full = join(targetDir, name)
      try {
        const st = statSync(full)
        if (st.mtimeMs >= sinceMs) {
          out.push({ path: full, size: st.size, mtimeMs: st.mtimeMs })
        }
      } catch { /* file vanished mid-scan */ }
    }
  } catch { /* dir missing on first crash-free run */ }
  return out
}
