import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createVersion,
  mutateLatestVersion,
  renameVersion,
  readVersionContent,
} from './mutations'
import { getLatestVersion, listVersions } from './resolve'
import { isVersionError } from './errors'
import { makeTestEnv, type TestEnv } from './test-helpers'

describe('createVersion', () => {
  let env: TestEnv
  beforeEach(() => {
    env = makeTestEnv()
    env.insertAsset('a1')
  })
  afterEach(() => env.cleanup())

  it('creates v1 from empty', () => {
    const v = createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'hi' })
    expect(v.version_num).toBe(1)
    expect(v.size).toBe(2)
  })

  it('increments version_num on each call', () => {
    createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'a' })
    createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'b' })
    const v = createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'c' })
    expect(v.version_num).toBe(3)
  })

  it('dedupes identical content (no new row)', () => {
    const v1 = createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'same' })
    const v2 = createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'same' })
    expect(v1.id).toBe(v2.id)
    expect(listVersions(env.db, 'a1')).toHaveLength(1)
  })

  it('records author', () => {
    const v = createVersion(env.db, env.txn, env.blobStore, {
      assetId: 'a1',
      bytes: 'x',
      author: { type: 'agent', id: 'claude-code' },
    })
    expect(v.author_type).toBe('agent')
    expect(v.author_id).toBe('claude-code')
  })
})

describe('mutateLatestVersion', () => {
  let env: TestEnv
  beforeEach(() => {
    env = makeTestEnv()
    env.insertAsset('a1')
  })
  afterEach(() => env.cleanup())

  it('creates v1 if none exist', () => {
    const v = mutateLatestVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'hi' })
    expect(v.version_num).toBe(1)
  })

  it('replaces hash on existing latest', () => {
    const a = createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'first' })
    const b = mutateLatestVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'second' })
    expect(b.id).toBe(a.id)
    expect(b.version_num).toBe(1)
    expect(b.content_hash).not.toBe(a.content_hash)
    expect(readVersionContent(env.blobStore, b).toString()).toBe('second')
  })

  it('refuses to mutate named version', () => {
    createVersion(env.db, env.txn, env.blobStore, {
      assetId: 'a1',
      bytes: 'pinned',
      name: 'milestone',
    })
    try {
      mutateLatestVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'changed' })
      throw new Error('expected throw')
    } catch (e) {
      expect(isVersionError(e) && e.code).toBe('NAMED_IMMUTABLE')
    }
  })
})

describe('createVersion (named / honorUnchanged)', () => {
  let env: TestEnv
  beforeEach(() => {
    env = makeTestEnv()
    env.insertAsset('a1')
  })
  afterEach(() => env.cleanup())

  it('with name, honors unchanged content (creates row anyway)', () => {
    createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'same' })
    createVersion(env.db, env.txn, env.blobStore, {
      assetId: 'a1',
      bytes: 'same',
      name: 'snap',
    })
    expect(listVersions(env.db, 'a1')).toHaveLength(2)
  })

  it('honorUnchanged forces a row without a name', () => {
    createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'same' })
    createVersion(env.db, env.txn, env.blobStore, {
      assetId: 'a1',
      bytes: 'same',
      honorUnchanged: true,
    })
    expect(listVersions(env.db, 'a1')).toHaveLength(2)
  })

  it('rejects reserved name', () => {
    try {
      createVersion(env.db, env.txn, env.blobStore, {
        assetId: 'a1',
        bytes: 'x',
        name: 'HEAD',
      })
      throw new Error('expected throw')
    } catch (e) {
      expect(isVersionError(e) && e.code).toBe('NAME_RESERVED')
    }
  })

  it('rejects duplicate name', () => {
    createVersion(env.db, env.txn, env.blobStore, {
      assetId: 'a1',
      bytes: 'a',
      name: 'pin',
    })
    try {
      createVersion(env.db, env.txn, env.blobStore, {
        assetId: 'a1',
        bytes: 'b',
        name: 'pin',
      })
      throw new Error('expected throw')
    } catch (e) {
      expect(isVersionError(e) && e.code).toBe('NAME_TAKEN')
    }
  })
})

describe('renameVersion', () => {
  let env: TestEnv
  beforeEach(() => {
    env = makeTestEnv()
    env.insertAsset('a1')
    createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'one' })
    createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'two' })
  })
  afterEach(() => env.cleanup())

  it('sets name', () => {
    const v = renameVersion(env.db, env.txn, 'a1', 1, 'first')
    expect(v.name).toBe('first')
  })

  it('clears name', () => {
    renameVersion(env.db, env.txn, 'a1', 1, 'first')
    const v = renameVersion(env.db, env.txn, 'a1', 1, null)
    expect(v.name).toBeNull()
  })

  it('rejects when name taken on other version', () => {
    renameVersion(env.db, env.txn, 'a1', 1, 'taken')
    try {
      renameVersion(env.db, env.txn, 'a1', 2, 'taken')
      throw new Error('expected throw')
    } catch (e) {
      expect(isVersionError(e) && e.code).toBe('NAME_TAKEN')
    }
  })

  it('allows rename of same version to same name', () => {
    renameVersion(env.db, env.txn, 'a1', 1, 'pin')
    const again = renameVersion(env.db, env.txn, 'a1', 1, 'pin')
    expect(again.name).toBe('pin')
  })
})

describe('latest reflects updates', () => {
  let env: TestEnv
  beforeEach(() => {
    env = makeTestEnv()
    env.insertAsset('a1')
  })
  afterEach(() => env.cleanup())

  it('getLatestVersion follows new versions', () => {
    createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'one' })
    expect(getLatestVersion(env.db, 'a1')?.version_num).toBe(1)
    createVersion(env.db, env.txn, env.blobStore, { assetId: 'a1', bytes: 'two' })
    expect(getLatestVersion(env.db, 'a1')?.version_num).toBe(2)
  })
})
