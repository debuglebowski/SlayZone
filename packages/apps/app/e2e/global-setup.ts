import { execSync } from 'child_process'

/**
 * Kill stale Electron processes from previous interrupted test runs.
 * Without this, a Ctrl+C'd run leaves an orphan Electron app visible
 * alongside the freshly launched one.
 */
export default function globalSetup() {
  try {
    // Find Electron processes running our e2e main entry point
    const out = execSync(
      'pgrep -af "Electron.*out/main/index\\.js" || true',
      { encoding: 'utf8', timeout: 5_000 }
    ).trim()

    if (!out) return

    for (const line of out.split('\n')) {
      const pid = parseInt(line.trim(), 10)
      if (!pid || pid === process.pid || pid === process.ppid) continue
      try {
        process.kill(pid, 'SIGTERM')
        console.log(`[global-setup] Killed stale Electron process ${pid}`)
      } catch {
        // Already dead or not ours
      }
    }
  } catch {
    // pgrep not available or other error — not fatal
  }
}
