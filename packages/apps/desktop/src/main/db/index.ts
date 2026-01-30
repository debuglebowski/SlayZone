import { app } from 'electron'
import Database from 'better-sqlite3'
import path from 'path'
import { runMigrations } from './migrations'

const getDatabasePath = (): string => {
  const userDataPath = app.getPath('userData')
  const dbName = app.isPackaged ? 'omgslayzone.sqlite' : 'omgslayzone.dev.sqlite'
  return path.join(userDataPath, dbName)
}

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
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
