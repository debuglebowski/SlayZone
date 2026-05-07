import path from 'node:path'
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  rmSync,
  copyFileSync,
  statSync,
  readdirSync,
} from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import { getDataRoot } from '@slayzone/platform'
import { uniqueName } from '@slayzone/file-editor/shared'
import { getExtensionFromTitle } from '../shared'
import type {
  CreateArtifactInput,
  UpdateArtifactInput,
  TaskArtifact,
  RenderMode,
  ArtifactFolder,
  CreateArtifactFolderInput,
  UpdateArtifactFolderInput,
} from '../shared'
import {
  BlobStore,
  betterSqliteTxn,
  createVersion,
  saveCurrent,
  setCurrentVersion,
  listVersions,
  resolveVersionRef,
  readVersionContent,
  renameVersion,
  pruneVersions,
  diffVersions,
  isVersionError,
} from '@slayzone/task-artifacts/server'
import type { AuthorContext, VersionRef } from '@slayzone/task-artifacts/shared'

const uiAuthor: AuthorContext = { type: 'user', id: null }

function dataDir(): string { return getDataRoot() }
function artifactsDir(): string { return path.join(dataDir(), 'artifacts') }

function getArtifactFilePath(taskId: string, artifactId: string, title: string): string {
  const ext = getExtensionFromTitle(title) || '.txt'
  return path.join(artifactsDir(), taskId, `${artifactId}${ext}`)
}

function getLegacyArtifactFilePath(taskId: string, artifactId: string, title: string): string {
  const ext = getExtensionFromTitle(title) || '.txt'
  return path.join(dataDir(), 'assets', taskId, `${artifactId}${ext}`)
}

export function parseArtifact(row: Record<string, unknown> | undefined): TaskArtifact | null {
  if (!row) return null
  return {
    id: row.id as string,
    task_id: row.task_id as string,
    folder_id: (row.folder_id as string) ?? null,
    title: row.title as string,
    render_mode: (row.render_mode as RenderMode) ?? null,
    view_mode: (row.view_mode as string) ?? null,
    readability_override: (row.readability_override as 'compact' | 'normal' | null) ?? null,
    width_override: (row.width_override as 'narrow' | 'wide' | null) ?? null,
    language: (row.language as string) ?? null,
    order: row.order as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    current_version_id: (row.current_version_id as string) ?? null,
  }
}

export function parseFolder(row: Record<string, unknown> | undefined): ArtifactFolder | null {
  if (!row) return null
  return {
    id: row.id as string,
    task_id: row.task_id as string,
    parent_id: (row.parent_id as string) ?? null,
    name: row.name as string,
    order: row.order as number,
    created_at: row.created_at as string,
  }
}

export function getBlobStore(): BlobStore { return new BlobStore(dataDir()) }

export function listArtifactsByTask(db: Database, taskId: string): TaskArtifact[] {
  const rows = db
    .prepare('SELECT * FROM task_artifacts WHERE task_id = ? ORDER BY "order" ASC, created_at ASC')
    .all(taskId) as Record<string, unknown>[]
  return rows.map(parseArtifact).filter((a): a is TaskArtifact => a !== null)
}

export function getArtifact(db: Database, id: string): TaskArtifact | null {
  const row = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return parseArtifact(row)
}

export function createArtifact(db: Database, data: CreateArtifactInput): TaskArtifact | null {
  const id = randomUUID()
  const folderId = data.folderId ?? null
  const maxOrder = (db.prepare(
    folderId
      ? 'SELECT MAX("order") as m FROM task_artifacts WHERE task_id = ? AND folder_id = ?'
      : 'SELECT MAX("order") as m FROM task_artifacts WHERE task_id = ? AND folder_id IS NULL'
  ).get(...(folderId ? [data.taskId, folderId] : [data.taskId])) as { m: number | null }).m ?? -1

  db.prepare(`
    INSERT INTO task_artifacts (id, task_id, folder_id, title, render_mode, language, "order")
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.taskId, folderId, data.title, data.renderMode ?? null, data.language ?? null, maxOrder + 1)

  const filePath = getArtifactFilePath(data.taskId, id, data.title)
  mkdirSync(path.dirname(filePath), { recursive: true })
  const initialBytes = Buffer.from(data.content ?? '', 'utf-8')
  writeFileSync(filePath, initialBytes)
  createVersion(db, betterSqliteTxn(db), getBlobStore(), { artifactId: id, bytes: initialBytes, author: uiAuthor })

  const row = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return parseArtifact(row)
}

export function updateArtifact(db: Database, data: UpdateArtifactInput & { mutateVersion?: boolean }): TaskArtifact | null {
  const existing = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(data.id) as Record<string, unknown> | undefined
  if (!existing) return null

  const sets: string[] = []
  const values: unknown[] = []
  if (data.title !== undefined) { sets.push('title = ?'); values.push(data.title) }
  if (data.folderId !== undefined) { sets.push('folder_id = ?'); values.push(data.folderId) }
  if (data.renderMode !== undefined) { sets.push('render_mode = ?'); values.push(data.renderMode) }
  if (data.viewMode !== undefined) { sets.push('view_mode = ?'); values.push(data.viewMode) }
  if (data.readabilityOverride !== undefined) { sets.push('readability_override = ?'); values.push(data.readabilityOverride) }
  if (data.widthOverride !== undefined) { sets.push('width_override = ?'); values.push(data.widthOverride) }
  if (data.language !== undefined) { sets.push('language = ?'); values.push(data.language) }
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')")
    values.push(data.id)
    db.prepare(`UPDATE task_artifacts SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  }

  const taskId = existing.task_id as string
  const oldTitle = existing.title as string
  const newTitle = data.title ?? oldTitle
  if (data.title !== undefined) {
    const oldExt = getExtensionFromTitle(oldTitle) || '.txt'
    const newExt = getExtensionFromTitle(newTitle) || '.txt'
    if (oldExt !== newExt) {
      const oldPath = path.join(artifactsDir(), taskId, `${data.id}${oldExt}`)
      const newPath = path.join(artifactsDir(), taskId, `${data.id}${newExt}`)
      if (existsSync(oldPath)) {
        const content = readFileSync(oldPath, 'utf-8')
        writeFileSync(newPath, content, 'utf-8')
        unlinkSync(oldPath)
      }
    }
  }

  if (data.content !== undefined) {
    const filePath = getArtifactFilePath(taskId, data.id, newTitle)
    mkdirSync(path.dirname(filePath), { recursive: true })
    const bytes = Buffer.from(data.content, 'utf-8')
    writeFileSync(filePath, bytes)
    if (data.mutateVersion) {
      saveCurrent(db, betterSqliteTxn(db), getBlobStore(), { artifactId: data.id, bytes, author: uiAuthor })
    } else {
      createVersion(db, betterSqliteTxn(db), getBlobStore(), { artifactId: data.id, bytes, author: uiAuthor })
    }
  }

  const row = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(data.id) as Record<string, unknown> | undefined
  return parseArtifact(row)
}

export function deleteArtifact(db: Database, id: string): boolean {
  const existing = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!existing) return false
  const filePath = getArtifactFilePath(existing.task_id as string, id, existing.title as string)
  if (existsSync(filePath)) unlinkSync(filePath)
  db.prepare('DELETE FROM task_artifacts WHERE id = ?').run(id)
  return true
}

export function reorderArtifacts(db: Database, data: string[] | { folderId: string | null; artifactIds: string[] }): void {
  const artifactIds = Array.isArray(data) ? data : data.artifactIds
  const stmt = db.prepare('UPDATE task_artifacts SET "order" = ? WHERE id = ?')
  db.transaction(() => {
    artifactIds.forEach((id, index) => stmt.run(index, id))
  })()
}

export function readArtifactContent(db: Database, id: string): string | null {
  const existing = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!existing) return null
  const filePath = getArtifactFilePath(existing.task_id as string, id, existing.title as string)
  if (existsSync(filePath)) return readFileSync(filePath, 'utf-8')
  const legacyPath = getLegacyArtifactFilePath(existing.task_id as string, id, existing.title as string)
  if (existsSync(legacyPath)) return readFileSync(legacyPath, 'utf-8')
  return ''
}

export function getArtifactPath(db: Database, id: string): string | null {
  const existing = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!existing) return null
  return getArtifactFilePath(existing.task_id as string, id, existing.title as string)
}

export function getArtifactMtime(db: Database, id: string): number | null {
  const existing = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!existing) return null
  const filePath = getArtifactFilePath(existing.task_id as string, id, existing.title as string)
  try { return statSync(filePath).mtimeMs } catch { return null }
}

export function uploadArtifact(db: Database, data: { taskId: string; sourcePath: string; title?: string }): TaskArtifact | null {
  const id = randomUUID()
  const title = data.title ?? path.basename(data.sourcePath)
  const maxOrder = (db.prepare('SELECT MAX("order") as m FROM task_artifacts WHERE task_id = ?').get(data.taskId) as { m: number | null }).m ?? -1
  db.prepare(`INSERT INTO task_artifacts (id, task_id, title, "order") VALUES (?, ?, ?, ?)`).run(id, data.taskId, title, maxOrder + 1)
  const filePath = getArtifactFilePath(data.taskId, id, title)
  mkdirSync(path.dirname(filePath), { recursive: true })
  copyFileSync(data.sourcePath, filePath)
  createVersion(db, betterSqliteTxn(db), getBlobStore(), { artifactId: id, bytes: readFileSync(filePath), author: uiAuthor })
  const row = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return parseArtifact(row)
}

export function uploadArtifactBlob(db: Database, data: { taskId: string; title: string; bytes: Uint8Array; folderId?: string | null }): TaskArtifact | null {
  const id = randomUUID()
  const folderId = data.folderId ?? null
  const siblingTitles = new Set<string>(
    (db.prepare(
      folderId
        ? 'SELECT title FROM task_artifacts WHERE task_id = ? AND folder_id = ?'
        : 'SELECT title FROM task_artifacts WHERE task_id = ? AND folder_id IS NULL'
    ).all(...(folderId ? [data.taskId, folderId] : [data.taskId])) as { title: string }[]).map((r) => r.title)
  )
  const title = uniqueName(data.title, siblingTitles)
  const maxOrder = (db.prepare(
    folderId
      ? 'SELECT MAX("order") as m FROM task_artifacts WHERE task_id = ? AND folder_id = ?'
      : 'SELECT MAX("order") as m FROM task_artifacts WHERE task_id = ? AND folder_id IS NULL'
  ).get(...(folderId ? [data.taskId, folderId] : [data.taskId])) as { m: number | null }).m ?? -1
  db.prepare(`INSERT INTO task_artifacts (id, task_id, folder_id, title, "order") VALUES (?, ?, ?, ?, ?)`)
    .run(id, data.taskId, folderId, title, maxOrder + 1)
  const filePath = getArtifactFilePath(data.taskId, id, title)
  mkdirSync(path.dirname(filePath), { recursive: true })
  const buf = Buffer.from(data.bytes)
  writeFileSync(filePath, buf)
  createVersion(db, betterSqliteTxn(db), getBlobStore(), { artifactId: id, bytes: buf, author: uiAuthor })
  const row = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return parseArtifact(row)
}

export function pasteArtifactFiles(db: Database, data: { sourcePaths: string[]; destTaskId: string; destFolderId: string | null }): TaskArtifact[] {
  const { sourcePaths, destTaskId, destFolderId } = data
  if (!sourcePaths.length) return []
  const artifactsRootPrefix = artifactsDir() + path.sep
  const created: TaskArtifact[] = []
  db.transaction(() => {
    for (const srcPath of sourcePaths) {
      if (!existsSync(srcPath)) continue
      const stat = statSync(srcPath)
      if (!stat.isFile()) continue
      const newId = randomUUID()
      let title = path.basename(srcPath)
      let renderMode: string | null = null
      let language: string | null = null
      if (srcPath.startsWith(artifactsRootPrefix)) {
        const idMatch = path.basename(srcPath).match(/^([0-9a-f-]{36})\./)
        if (idMatch) {
          const sourceRow = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(idMatch[1]) as Record<string, unknown> | undefined
          if (sourceRow) {
            title = sourceRow.title as string
            renderMode = (sourceRow.render_mode as string | null) ?? null
            language = (sourceRow.language as string | null) ?? null
          }
        }
      }
      const siblingTitles = new Set<string>(
        (db.prepare(
          destFolderId
            ? 'SELECT title FROM task_artifacts WHERE task_id = ? AND folder_id = ?'
            : 'SELECT title FROM task_artifacts WHERE task_id = ? AND folder_id IS NULL'
        ).all(...(destFolderId ? [destTaskId, destFolderId] : [destTaskId])) as { title: string }[]).map((r) => r.title)
      )
      title = uniqueName(title, siblingTitles)
      const maxOrder = (db.prepare(
        destFolderId
          ? 'SELECT MAX("order") as m FROM task_artifacts WHERE task_id = ? AND folder_id = ?'
          : 'SELECT MAX("order") as m FROM task_artifacts WHERE task_id = ? AND folder_id IS NULL'
      ).get(...(destFolderId ? [destTaskId, destFolderId] : [destTaskId])) as { m: number | null }).m ?? -1
      db.prepare(`INSERT INTO task_artifacts (id, task_id, folder_id, title, render_mode, language, "order") VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(newId, destTaskId, destFolderId, title, renderMode, language, maxOrder + 1)
      const destFilePath = getArtifactFilePath(destTaskId, newId, title)
      mkdirSync(path.dirname(destFilePath), { recursive: true })
      copyFileSync(srcPath, destFilePath)
      createVersion(db, betterSqliteTxn(db), getBlobStore(), { artifactId: newId, bytes: readFileSync(destFilePath), author: uiAuthor })
      const row = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(newId) as Record<string, unknown> | undefined
      const parsed = parseArtifact(row)
      if (parsed) created.push(parsed)
    }
  })()
  return created
}

export function uploadArtifactDir(db: Database, data: { taskId: string; dirPath: string; parentFolderId: string | null }): { folders: ArtifactFolder[]; artifacts: TaskArtifact[] } {
  const createdFolders: ArtifactFolder[] = []
  const createdArtifacts: TaskArtifact[] = []
  function walkDir(dirPath: string, parentFolderId: string | null): void {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        const folderId = randomUUID()
        const maxOrder = (db.prepare(
          parentFolderId
            ? 'SELECT MAX("order") as m FROM artifact_folders WHERE task_id = ? AND parent_id = ?'
            : 'SELECT MAX("order") as m FROM artifact_folders WHERE task_id = ? AND parent_id IS NULL'
        ).get(...(parentFolderId ? [data.taskId, parentFolderId] : [data.taskId])) as { m: number | null }).m ?? -1
        db.prepare(`INSERT INTO artifact_folders (id, task_id, parent_id, name, "order") VALUES (?, ?, ?, ?, ?)`)
          .run(folderId, data.taskId, parentFolderId, entry.name, maxOrder + 1)
        const row = db.prepare('SELECT * FROM artifact_folders WHERE id = ?').get(folderId) as Record<string, unknown> | undefined
        const parsed = parseFolder(row)
        if (parsed) createdFolders.push(parsed)
        walkDir(fullPath, folderId)
      } else if (entry.isFile()) {
        const artifactId = randomUUID()
        const title = entry.name
        const maxOrder = (db.prepare(
          parentFolderId
            ? 'SELECT MAX("order") as m FROM task_artifacts WHERE task_id = ? AND folder_id = ?'
            : 'SELECT MAX("order") as m FROM task_artifacts WHERE task_id = ? AND folder_id IS NULL'
        ).get(...(parentFolderId ? [data.taskId, parentFolderId] : [data.taskId])) as { m: number | null }).m ?? -1
        db.prepare(`INSERT INTO task_artifacts (id, task_id, folder_id, title, "order") VALUES (?, ?, ?, ?, ?)`)
          .run(artifactId, data.taskId, parentFolderId, title, maxOrder + 1)
        const filePath = getArtifactFilePath(data.taskId, artifactId, title)
        mkdirSync(path.dirname(filePath), { recursive: true })
        copyFileSync(fullPath, filePath)
        const row = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(artifactId) as Record<string, unknown> | undefined
        const parsed = parseArtifact(row)
        if (parsed) createdArtifacts.push(parsed)
      }
    }
  }
  db.transaction(() => walkDir(data.dirPath, data.parentFolderId))()
  return { folders: createdFolders, artifacts: createdArtifacts }
}

export function cleanupTaskArtifacts(taskId: string): void {
  const taskDir = path.join(artifactsDir(), taskId)
  if (existsSync(taskDir)) rmSync(taskDir, { recursive: true, force: true })
}

// --- Versions ---

export function wrapVersionError<T>(fn: () => T): T {
  try { return fn() } catch (err: unknown) {
    if (isVersionError(err)) throw new Error(`[${err.code}] ${err.message}`)
    throw err
  }
}

export function listArtifactVersions(db: Database, artifactId: string, opts: { limit?: number; offset?: number } = {}) {
  return listVersions(db, artifactId, opts)
}

export function readArtifactVersion(db: Database, artifactId: string, versionRef: VersionRef): string {
  return wrapVersionError(() => {
    const v = resolveVersionRef(db, artifactId, versionRef)
    return readVersionContent(getBlobStore(), v).toString('utf-8')
  })
}

export function createArtifactVersion(db: Database, artifactId: string, name?: string | null) {
  return wrapVersionError(() => {
    const existing = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(artifactId) as Record<string, unknown> | undefined
    if (!existing) throw new Error('Artifact not found')
    const filePath = getArtifactFilePath(existing.task_id as string, artifactId, existing.title as string)
    const bytes = existsSync(filePath) ? readFileSync(filePath) : Buffer.alloc(0)
    return createVersion(db, betterSqliteTxn(db), getBlobStore(), {
      artifactId,
      bytes,
      name: name ?? null,
      honorUnchanged: true,
      author: uiAuthor,
    })
  })
}

export function renameArtifactVersion(db: Database, artifactId: string, versionRef: VersionRef, newName: string | null) {
  return wrapVersionError(() => renameVersion(db, betterSqliteTxn(db), artifactId, versionRef, newName))
}

export function diffArtifactVersions(db: Database, artifactId: string, a: VersionRef, b?: VersionRef) {
  return wrapVersionError(() => diffVersions(db, getBlobStore(), { artifactId, a, b }))
}

export function pruneArtifactVersions(
  db: Database,
  artifactId: string,
  opts: { keepLast?: number; keepNamed?: boolean; keepCurrent?: boolean; dryRun?: boolean },
) {
  return wrapVersionError(() => pruneVersions(db, betterSqliteTxn(db), getBlobStore(), artifactId, opts))
}

export function setCurrentArtifactVersion(db: Database, artifactId: string, versionRef: VersionRef) {
  return wrapVersionError(() => {
    const existing = db.prepare('SELECT * FROM task_artifacts WHERE id = ?').get(artifactId) as Record<string, unknown> | undefined
    if (!existing) throw new Error('Artifact not found')
    const v = setCurrentVersion(db, betterSqliteTxn(db), artifactId, versionRef)
    const bytes = readVersionContent(getBlobStore(), v)
    const filePath = getArtifactFilePath(existing.task_id as string, artifactId, existing.title as string)
    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, bytes)
    return v
  })
}

// --- Folders ---

export function listFoldersByTask(db: Database, taskId: string): ArtifactFolder[] {
  const rows = db
    .prepare('SELECT * FROM artifact_folders WHERE task_id = ? ORDER BY "order" ASC, created_at ASC')
    .all(taskId) as Record<string, unknown>[]
  return rows.map(parseFolder).filter((f): f is ArtifactFolder => f !== null)
}

export function createFolder(db: Database, data: CreateArtifactFolderInput): ArtifactFolder | null {
  const id = randomUUID()
  const parentId = data.parentId ?? null
  const maxOrder = (db.prepare(
    parentId
      ? 'SELECT MAX("order") as m FROM artifact_folders WHERE task_id = ? AND parent_id = ?'
      : 'SELECT MAX("order") as m FROM artifact_folders WHERE task_id = ? AND parent_id IS NULL'
  ).get(...(parentId ? [data.taskId, parentId] : [data.taskId])) as { m: number | null }).m ?? -1
  db.prepare(`INSERT INTO artifact_folders (id, task_id, parent_id, name, "order") VALUES (?, ?, ?, ?, ?)`)
    .run(id, data.taskId, parentId, data.name, maxOrder + 1)
  const row = db.prepare('SELECT * FROM artifact_folders WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return parseFolder(row)
}

export function updateFolder(db: Database, data: UpdateArtifactFolderInput): ArtifactFolder | null {
  const existing = db.prepare('SELECT * FROM artifact_folders WHERE id = ?').get(data.id) as Record<string, unknown> | undefined
  if (!existing) return null
  const sets: string[] = []
  const values: unknown[] = []
  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
  if (data.parentId !== undefined) { sets.push('parent_id = ?'); values.push(data.parentId) }
  if (sets.length > 0) {
    values.push(data.id)
    db.prepare(`UPDATE artifact_folders SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  }
  const row = db.prepare('SELECT * FROM artifact_folders WHERE id = ?').get(data.id) as Record<string, unknown> | undefined
  return parseFolder(row)
}

export function deleteFolder(db: Database, id: string): boolean {
  const existing = db.prepare('SELECT * FROM artifact_folders WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!existing) return false
  db.prepare('DELETE FROM artifact_folders WHERE id = ?').run(id)
  return true
}

export function reorderFolders(db: Database, data: { parentId: string | null; folderIds: string[] }): void {
  const stmt = db.prepare('UPDATE artifact_folders SET "order" = ? WHERE id = ?')
  db.transaction(() => {
    data.folderIds.forEach((id, index) => stmt.run(index, id))
  })()
}
