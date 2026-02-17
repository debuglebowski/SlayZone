import { safeStorage } from 'electron'
import type { Database } from 'better-sqlite3'

function toSettingKey(ref: string): string {
  return `integration:credential:${ref}`
}

export function storeCredential(db: Database, ref: string, secret: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS secure credential storage is unavailable on this machine')
  }
  const encrypted = safeStorage.encryptString(secret)
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    toSettingKey(ref),
    encrypted.toString('base64')
  )
}

export function readCredential(db: Database, ref: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS secure credential storage is unavailable on this machine')
  }
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(toSettingKey(ref)) as
    | { value: string }
    | undefined
  if (!row?.value) {
    throw new Error('Credential not found')
  }
  const encrypted = Buffer.from(row.value, 'base64')
  return safeStorage.decryptString(encrypted)
}

export function deleteCredential(db: Database, ref: string): void {
  db.prepare('DELETE FROM settings WHERE key = ?').run(toSettingKey(ref))
}
