import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createVersion } from './mutations'
import { checkIntegrity } from './integrity'
import { makeTestEnv, type TestEnv } from './test-helpers'

describe('checkIntegrity', () => {
  let env: TestEnv
  beforeEach(() => {
    env = makeTestEnv()
    env.insertAsset('a1')
  })
  afterEach(() => env.cleanup())

  it('reports zero issues on clean store', () => {
    createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'ok' })
    const r = checkIntegrity(env.db, env.blobStore)
    expect(r.checked).toBe(1)
    expect(r.issues).toHaveLength(0)
  })

  it('flags blob_missing', () => {
    const v = createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'lost' })
    env.blobStore.delete(v.content_hash)
    const r = checkIntegrity(env.db, env.blobStore)
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0].problem).toBe('blob_missing')
  })

  it('scopes to one asset', () => {
    env.insertAsset('a2', 'task-1', 'b.md')
    createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'one' })
    createVersion(env.db, env.txn, env.blobStore, { assetId: 'a2', bytes: 'two' })
    const r = checkIntegrity(env.db, env.blobStore, { assetId: 'a1' })
    expect(r.checked).toBe(1)
  })
})
