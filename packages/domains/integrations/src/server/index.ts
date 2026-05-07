import type { Database } from 'better-sqlite3'
import { createIntegrationOps } from './handlers-store'

export { ensureIntegrationSchema } from './handlers-store'
export { createIntegrationOps } from './handlers-store'
export { storeCredential, readCredential, deleteCredential } from './credentials'
export { setStorageAdapter, getStorageAdapter } from './storage-adapter'
export type { StorageAdapter } from './storage-adapter'
export { NodeStorageAdapter } from './storage-adapter-node'
export type IntegrationOps = ReturnType<typeof createIntegrationOps>

let integrationOps: IntegrationOps | null = null

export function initIntegrationOps(db: Database, options?: { enableTestChannels?: boolean }): IntegrationOps {
  integrationOps = createIntegrationOps(db, options)
  return integrationOps
}

export function getIntegrationOps(): IntegrationOps {
  if (!integrationOps) throw new Error('integrationOps not initialized — call initIntegrationOps(db) first')
  return integrationOps
}

export {
  runProviderSync,
  pushNewTaskToProviders,
  pushTaskAfterEdit,
  pushArchiveToProviders,
  pushUnarchiveToProviders,
  startSyncPoller,
  startDiscoveryPoller,
  resetSyncFlags,
  getDesiredRemoteStatusId,
} from './sync'
