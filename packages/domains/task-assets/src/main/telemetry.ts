import { BlobStore } from './blob-store'
import type { DbLike } from './db'
import type { AssetId, StorageStats } from '../shared/types'

/**
 * Aggregate disk usage from the blob store, grouped by asset.
 * Useful for surfacing "this asset has X versions taking Y MB" in UI
 * and as a heuristic for when to suggest pruning.
 */
export function getStorageStats(db: DbLike, _blobStore: BlobStore): StorageStats {
  const totalRow = db
    .prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS s FROM asset_blobs')
    .get() as { n: number; s: number }

  const perAssetRows = db
    .prepare(
      `SELECT av.asset_id AS asset_id,
              COALESCE(SUM(b.size), 0) AS bytes,
              COUNT(av.id) AS versions
       FROM asset_versions av
       LEFT JOIN asset_blobs b ON b.hash = av.content_hash
       GROUP BY av.asset_id`
    )
    .all() as { asset_id: string; bytes: number; versions: number }[]

  return {
    totalBlobs: totalRow.n,
    totalBytes: totalRow.s,
    perAsset: perAssetRows.map((r) => ({
      asset_id: r.asset_id as AssetId,
      bytes: r.bytes,
      versions: r.versions,
    })),
  }
}
