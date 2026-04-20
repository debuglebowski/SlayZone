import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { BlobStore } from './blob-store'
import type { DbLike, TxnRunner } from './db'
import type { SeedProgressCallback, SeedReport, VersionId } from '../shared/types'

export interface SeedArgs {
  resolveFilePath: (row: { id: string; task_id: string; title: string }) => string
  onProgress?: SeedProgressCallback
}

/**
 * Idempotent: for every `task_assets` row without any `asset_versions`,
 * read the current file bytes, write a blob, insert v1.
 *
 * Synchronous + per-asset txn so a single failure doesn't kill the run.
 * Calls `onProgress` after each asset (success or skip) for UI updates.
 */
export function seedInitialVersions(
  db: DbLike,
  txn: TxnRunner,
  blobStore: BlobStore,
  args: SeedArgs
): SeedReport {
  const needsSeed = db
    .prepare(
      `SELECT ta.id, ta.task_id, ta.title
       FROM task_assets ta
       LEFT JOIN asset_versions av ON av.asset_id = ta.id
       WHERE av.id IS NULL
       GROUP BY ta.id`
    )
    .all() as { id: string; task_id: string; title: string }[]

  let seeded = 0
  let skippedMissing = 0

  const insertVersion = db.prepare(
    `INSERT INTO asset_versions
     (id, asset_id, version_num, content_hash, size, name, author_type, author_id, parent_id)
     VALUES (?, ?, 1, ?, ?, NULL, NULL, NULL, NULL)`
  )
  const insertBlob = db.prepare(
    'INSERT OR IGNORE INTO asset_blobs (hash, size) VALUES (?, ?)'
  )
  const setCurrent = db.prepare(
    'UPDATE task_assets SET current_version_id = ? WHERE id = ?'
  )

  const total = needsSeed.length
  for (let i = 0; i < needsSeed.length; i++) {
    const row = needsSeed[i]
    args.onProgress?.({ total, done: i, current: row.id as never })
    const filePath = args.resolveFilePath(row)
    if (!existsSync(filePath)) {
      skippedMissing++
      continue
    }
    const buf = readFileSync(filePath)
    txn(() => {
      const blob = blobStore.write(buf)
      insertBlob.run(blob.hash, blob.size)
      const versionId = randomUUID() as VersionId
      insertVersion.run(versionId, row.id, blob.hash, blob.size)
      setCurrent.run(versionId, row.id)
    })
    seeded++
  }
  args.onProgress?.({ total, done: total, current: null })

  return { seeded, skippedMissing }
}
