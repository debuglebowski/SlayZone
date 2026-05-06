/**
 * v127 disk-dir migration helper.
 *
 * v127 renamed the "assets" feature to "artifacts" in the DB. The on-disk
 * directory was meant to be renamed in lockstep — but a copy-paste typo in
 * the original boot-time block left both `oldDir` and `newDir` pointing at
 * `artifacts/`, so the rename never fired and pre-v127 user content stayed
 * orphaned in `assets/` while the read path looked in `artifacts/`. Affected
 * users see "Write markdown..." placeholder for every artifact.
 *
 * This helper handles three states a user can be in by the time the fix
 * ships:
 *  - noop:   only `artifacts/` exists (clean install on v127+).
 *  - rename: only `assets/` exists (never opened buggy v127 build).
 *  - merge:  both exist (opened buggy build → a fresh empty `artifacts/`
 *            was created by `db:artifacts:create` / watcher / mkdir-on-demand
 *            while real content remained in `assets/`).
 *
 * Merge is non-destructive: a file in `assets/` is moved only when no file
 * with the same path exists in `artifacts/`. Conflicts are counted and left
 * in place so a user can recover them manually if needed.
 */

import { existsSync, readdirSync, renameSync, rmdirSync, statSync } from 'fs'
import { join } from 'path'

export type V127DiskReport = {
  mode: 'noop' | 'rename' | 'merge'
  taskDirsMoved: number
  filesMoved: number
  conflicts: number
  oldDirRemoved: boolean
}

export function migrateV127DiskDir(oldDir: string, newDir: string): V127DiskReport {
  if (!existsSync(oldDir)) {
    return { mode: 'noop', taskDirsMoved: 0, filesMoved: 0, conflicts: 0, oldDirRemoved: false }
  }
  if (!existsSync(newDir)) {
    renameSync(oldDir, newDir)
    return { mode: 'rename', taskDirsMoved: 0, filesMoved: 0, conflicts: 0, oldDirRemoved: true }
  }

  let taskDirsMoved = 0
  let filesMoved = 0
  let conflicts = 0

  for (const name of readdirSync(oldDir)) {
    const srcPath = join(oldDir, name)
    const dstPath = join(newDir, name)
    let srcStat
    try { srcStat = statSync(srcPath) } catch { continue }

    if (!srcStat.isDirectory()) {
      // Stray file at root (e.g. .DS_Store). Move only if no conflict.
      if (existsSync(dstPath)) conflicts++
      else { renameSync(srcPath, dstPath); filesMoved++ }
      continue
    }

    if (!existsSync(dstPath)) {
      renameSync(srcPath, dstPath)
      taskDirsMoved++
      continue
    }

    // Both task dirs exist — merge file-by-file.
    for (const fname of readdirSync(srcPath)) {
      const sFile = join(srcPath, fname)
      const dFile = join(dstPath, fname)
      let s
      try { s = statSync(sFile) } catch { continue }
      if (!s.isFile()) continue
      if (existsSync(dFile)) {
        conflicts++
      } else {
        renameSync(sFile, dFile)
        filesMoved++
      }
    }
    try { rmdirSync(srcPath) } catch { /* non-empty after merge: leave */ }
  }

  let oldDirRemoved = false
  try { rmdirSync(oldDir); oldDirRemoved = true } catch { /* leave for manual recovery */ }
  return { mode: 'merge', taskDirsMoved, filesMoved, conflicts, oldDirRemoved }
}
