import { BlobStore } from './blob-store'
import type { DbLike } from './db'
import { parseRows } from './parse'
import type { AssetId, IntegrityIssue, IntegrityReport } from '../shared/types'

export interface IntegrityScope {
  assetId?: AssetId | string
}

/**
 * Verifies that every version row has a backing blob and the blob's bytes
 * actually hash to the recorded `content_hash` and report the recorded
 * `size`. Use to catch FS corruption, partial restores, manual rm.
 *
 * Read-only. Returns a list of issues — caller decides how to remediate.
 */
export function checkIntegrity(
  db: DbLike,
  blobStore: BlobStore,
  scope: IntegrityScope = {}
): IntegrityReport {
  const sql = scope.assetId
    ? 'SELECT * FROM asset_versions WHERE asset_id = ? ORDER BY asset_id, version_num'
    : 'SELECT * FROM asset_versions ORDER BY asset_id, version_num'
  const rows = scope.assetId
    ? db.prepare(sql).all(scope.assetId)
    : db.prepare(sql).all()
  const versions = parseRows(rows)

  const issues: IntegrityIssue[] = []
  for (const v of versions) {
    if (!blobStore.has(v.content_hash)) {
      issues.push({
        asset_id: v.asset_id,
        version_id: v.id,
        version_num: v.version_num,
        content_hash: v.content_hash,
        problem: 'blob_missing',
      })
      continue
    }
    if (blobStore.size(v.content_hash) !== v.size) {
      issues.push({
        asset_id: v.asset_id,
        version_id: v.id,
        version_num: v.version_num,
        content_hash: v.content_hash,
        problem: 'size_mismatch',
      })
      continue
    }
    if (!blobStore.verify(v.content_hash)) {
      issues.push({
        asset_id: v.asset_id,
        version_id: v.id,
        version_num: v.version_num,
        content_hash: v.content_hash,
        problem: 'hash_mismatch',
      })
    }
  }

  return { checked: versions.length, issues }
}
