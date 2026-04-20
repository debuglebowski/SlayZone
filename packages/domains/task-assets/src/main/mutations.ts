import { randomUUID } from 'node:crypto'
import { BlobStore } from './blob-store'
import type { DbLike, TxnRunner } from './db'
import { VersionError } from './errors'
import { parseRow } from './parse'
import { getLatestVersion, isReservedName, resolveVersionRef } from './resolve'
import type { AssetId, AssetVersion, AuthorContext, VersionId, VersionRef } from '../shared/types'

export interface CreateVersionArgs {
  assetId: AssetId | string
  bytes: Buffer | string
  author?: AuthorContext
  /** Optional label. If set, forces row creation even when content matches latest. */
  name?: string | null
  /** Force row creation even when content matches latest. Implicit when `name` is set. */
  honorUnchanged?: boolean
}

function nextVersionNum(db: DbLike, assetId: AssetId | string): number {
  const row = db
    .prepare('SELECT MAX(version_num) AS m FROM asset_versions WHERE asset_id = ?')
    .get(assetId) as { m: number | null }
  return (row.m ?? 0) + 1
}

function insertBlobRow(db: DbLike, hash: string, size: number): void {
  db.prepare('INSERT OR IGNORE INTO asset_blobs (hash, size) VALUES (?, ?)').run(hash, size)
}

function selectVersionById(db: DbLike, id: string): AssetVersion {
  const row = db.prepare('SELECT * FROM asset_versions WHERE id = ?').get(id)
  const parsed = parseRow(row)
  if (!parsed) throw new VersionError('NOT_FOUND', `Version row vanished after insert: ${id}`, { id })
  return parsed
}

function checkNameAvailable(db: DbLike, assetId: AssetId | string, name: string, ignoreId?: string): void {
  if (isReservedName(name)) {
    throw new VersionError('NAME_RESERVED', `Name "${name}" is reserved`, { name })
  }
  const sql = ignoreId
    ? 'SELECT id FROM asset_versions WHERE asset_id = ? AND name = ? AND id != ?'
    : 'SELECT id FROM asset_versions WHERE asset_id = ? AND name = ?'
  const existing = ignoreId
    ? db.prepare(sql).get(assetId, name, ignoreId)
    : db.prepare(sql).get(assetId, name)
  if (existing) {
    throw new VersionError('NAME_TAKEN', `Name "${name}" already used on another version`, {
      name,
    })
  }
}

/**
 * Append a new version.
 *
 * - Default: dedupes if content matches the previous latest (returns that
 *   latest row, no new INSERT). Idempotent for repeated identical writes.
 * - With `name`: always creates a row (names mark intent). Name must be
 *   unique per asset, not reserved.
 * - With `honorUnchanged: true`: always creates a row even w/o name.
 */
export function createVersion(
  db: DbLike,
  txn: TxnRunner,
  blobStore: BlobStore,
  args: CreateVersionArgs
): AssetVersion {
  return txn(() => {
    if (args.name) checkNameAvailable(db, args.assetId, args.name)
    const latest = getLatestVersion(db, args.assetId)
    const blob = blobStore.write(args.bytes)
    const dedup = !args.honorUnchanged && !args.name
    if (dedup && latest && latest.content_hash === blob.hash) {
      return latest
    }
    insertBlobRow(db, blob.hash, blob.size)
    const id = randomUUID() as VersionId
    db.prepare(
      `INSERT INTO asset_versions
       (id, asset_id, version_num, content_hash, size, name, author_type, author_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      args.assetId,
      nextVersionNum(db, args.assetId),
      blob.hash,
      blob.size,
      args.name ?? null,
      args.author?.type ?? null,
      args.author?.id ?? null
    )
    return selectVersionById(db, id)
  })
}

/**
 * Replace the latest version's content in place. Refuses to mutate
 * named versions — names are stable anchors. If no versions exist
 * yet, falls back to `createVersion` so callers don't need to branch.
 */
export function mutateLatestVersion(
  db: DbLike,
  txn: TxnRunner,
  blobStore: BlobStore,
  args: CreateVersionArgs
): AssetVersion {
  return txn(() => {
    const latest = getLatestVersion(db, args.assetId)
    if (!latest) {
      const blob = blobStore.write(args.bytes)
      insertBlobRow(db, blob.hash, blob.size)
      const id = randomUUID() as VersionId
      db.prepare(
        `INSERT INTO asset_versions
         (id, asset_id, version_num, content_hash, size, name, author_type, author_id)
         VALUES (?, ?, 1, ?, ?, NULL, ?, ?)`
      ).run(
        id,
        args.assetId,
        blob.hash,
        blob.size,
        args.author?.type ?? null,
        args.author?.id ?? null
      )
      return selectVersionById(db, id)
    }
    if (latest.name !== null) {
      throw new VersionError(
        'NAMED_IMMUTABLE',
        `Cannot mutate named version "${latest.name}" (v${latest.version_num})`,
        { name: latest.name, version_num: latest.version_num }
      )
    }
    const blob = blobStore.write(args.bytes)
    if (latest.content_hash === blob.hash) return latest
    insertBlobRow(db, blob.hash, blob.size)
    db.prepare('UPDATE asset_versions SET content_hash = ?, size = ? WHERE id = ?').run(
      blob.hash,
      blob.size,
      latest.id
    )
    return selectVersionById(db, latest.id)
  })
}

export function renameVersion(
  db: DbLike,
  txn: TxnRunner,
  assetId: AssetId | string,
  ref: VersionRef,
  newName: string | null
): AssetVersion {
  return txn(() => {
    const version = resolveVersionRef(db, assetId, ref)
    if (newName !== null) checkNameAvailable(db, assetId, newName, version.id)
    db.prepare('UPDATE asset_versions SET name = ? WHERE id = ?').run(newName, version.id)
    return selectVersionById(db, version.id)
  })
}

export function readVersionContent(blobStore: BlobStore, version: AssetVersion): Buffer {
  return blobStore.read(version.content_hash)
}
