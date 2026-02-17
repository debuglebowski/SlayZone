import { app } from 'electron'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { runMigrations } from './migrations'

const LEGACY_APP_NAME = 'omgslayzone'
const LEGACY_DB_NAMES = ['omgslayzone.sqlite', 'omgslayzone.dev.sqlite'] as const
const DB_SUFFIXES = ['', '-wal', '-shm'] as const

const getDatabasePath = (): string => {
  const userDataPath = process.env.SLAYZONE_DB_DIR || app.getPath('userData')
  const dbName = app.isPackaged ? 'slayzone.sqlite' : 'slayzone.dev.sqlite'
  return path.join(userDataPath, dbName)
}

let db: Database.Database | null = null

export function migrateLegacyDatabaseIfNeeded(): void {
  const oldUserData = path.join(app.getPath('appData'), LEGACY_APP_NAME)
  const newUserData = app.getPath('userData')

  if (!fs.existsSync(oldUserData)) return

  const migrations = [
    { oldBase: LEGACY_DB_NAMES[0], newBase: 'slayzone.sqlite' },
    { oldBase: LEGACY_DB_NAMES[1], newBase: 'slayzone.dev.sqlite' }
  ]

  let backupDir: string | null = null

  for (const { oldBase, newBase } of migrations) {
    const oldBasePath = path.join(oldUserData, oldBase)
    const newBasePath = path.join(newUserData, newBase)

    if (!fs.existsSync(oldBasePath) || fs.existsSync(newBasePath)) {
      continue
    }

    fs.mkdirSync(newUserData, { recursive: true })

    if (!backupDir) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      backupDir = path.join(oldUserData, `backup-${timestamp}`)
      fs.mkdirSync(backupDir, { recursive: true })
    }

    for (const suffix of DB_SUFFIXES) {
      const oldPath = `${oldBasePath}${suffix}`
      if (!fs.existsSync(oldPath)) continue

      const backupPath = path.join(backupDir, `${oldBase}${suffix}`)
      fs.copyFileSync(oldPath, backupPath)

      const newPath = path.join(newUserData, `${newBase}${suffix}`)
      fs.copyFileSync(oldPath, newPath)
    }
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    migrateLegacyDatabaseIfNeeded()
    const dbPath = getDatabasePath()
    console.log('Database path:', dbPath)
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
