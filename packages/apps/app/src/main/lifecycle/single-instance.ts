// Single-instance lock acquisition with stale-lock self-heal.
//
// If `requestSingleInstanceLock()` fails, we verify the lock-holder PID is alive
// before deciding the lock is stale. Four safety gates ensure we NEVER kick a
// live owner:
//   1. Null PID (Windows or unreadable) → never delete
//   2. Own PID → never delete
//   3. PID alive (or EPERM = alive different user) → never delete
//   4. PID changed between checks (race) → never delete
//
// Runs BEFORE the diagnostics DB opens, so the verdict is returned to the
// caller for later emission once DB is ready.
import { app } from 'electron'
import { readlinkSync, unlinkSync } from 'fs'
import { join } from 'path'

const LOCK_FILES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'] as const

export type LockOutcome =
  | { kind: 'acquired' }
  | { kind: 'recovered'; stalePid: number }
  | { kind: 'live_owner'; pid: number }
  | { kind: 'unreadable' }
  | { kind: 'race'; pid: number }
  | { kind: 'unlink_failed'; pid: number }
  | { kind: 'retry_failed'; pid: number }

function readLockHolderPid(userData: string): number | null {
  if (process.platform === 'win32') return null  // Windows uses file-handle lock, no PID
  try {
    const target = readlinkSync(join(userData, 'SingletonLock'))
    const m = /-(\d+)$/.exec(target)              // format: "<hostname>-<pid>"
    return m ? Number(m[1]) : null
  } catch {
    return null
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    return code === 'EPERM'  // EPERM = exists but no perms (different user)
  }
}

function unlinkLockFiles(userData: string): boolean {
  let mainUnlinked = false
  for (const name of LOCK_FILES) {
    try {
      unlinkSync(join(userData, name))
      if (name === 'SingletonLock') mainUnlinked = true
    } catch { /* sibling files may not exist; only main lock matters */ }
  }
  return mainUnlinked
}

export function acquireLockWithSelfHeal(): LockOutcome {
  if (app.requestSingleInstanceLock()) return { kind: 'acquired' }

  const userData = app.getPath('userData')
  const pid = readLockHolderPid(userData)

  if (pid === null) return { kind: 'unreadable' }
  if (pid === process.pid) return { kind: 'live_owner', pid }
  if (isPidAlive(pid)) return { kind: 'live_owner', pid }
  // Re-read in case lock changed between alive-check and unlink (PID-reuse race)
  if (readLockHolderPid(userData) !== pid) return { kind: 'race', pid }

  if (!unlinkLockFiles(userData)) return { kind: 'unlink_failed', pid }

  return app.requestSingleInstanceLock()
    ? { kind: 'recovered', stalePid: pid }
    : { kind: 'retry_failed', pid }
}

export function lockOutcomeIsAcquired(outcome: LockOutcome): boolean {
  return outcome.kind === 'acquired' || outcome.kind === 'recovered'
}
