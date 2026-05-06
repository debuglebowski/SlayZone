/**
 * v127 disk-dir migration tests.
 * Run with: ELECTRON_RUN_AS_NODE=1 npx electron --import tsx/esm packages/apps/app/src/main/db/v127-disk-migration.test.ts
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { migrateV127DiskDir } from './v127-disk-migration.js'

let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ✗ ${name}`)
    console.error(`    ${e instanceof Error ? e.message : String(e)}`)
    failed++
  }
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg)
}
function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

function freshRoot(): { root: string; old: string; new_: string } {
  const root = mkdtempSync(join(tmpdir(), 'v127-test-'))
  return { root, old: join(root, 'assets'), new_: join(root, 'artifacts') }
}
function cleanup(root: string): void { rmSync(root, { recursive: true, force: true }) }

function seedFile(p: string, content: string): void {
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, content, 'utf-8')
}

console.log('v127 disk-dir migration')

test('noop when neither dir exists', () => {
  const { root, old, new_ } = freshRoot()
  try {
    rmSync(root, { recursive: true, force: true })
    const r = migrateV127DiskDir(old, new_)
    assertEq(r.mode, 'noop', 'mode')
    assert(!existsSync(old), 'old should not exist')
    assert(!existsSync(new_), 'new should not exist')
  } finally { cleanup(root) }
})

test('noop when only new exists', () => {
  const { root, old, new_ } = freshRoot()
  try {
    seedFile(join(new_, 'taskA', 'file.md'), 'fresh')
    const r = migrateV127DiskDir(old, new_)
    assertEq(r.mode, 'noop', 'mode')
    assertEq(readFileSync(join(new_, 'taskA', 'file.md'), 'utf-8'), 'fresh', 'fresh untouched')
  } finally { cleanup(root) }
})

test('rename when only old exists', () => {
  const { root, old, new_ } = freshRoot()
  try {
    seedFile(join(old, 'taskA', 'a.md'), 'A')
    seedFile(join(old, 'taskB', 'b.md'), 'B')
    const r = migrateV127DiskDir(old, new_)
    assertEq(r.mode, 'rename', 'mode')
    assertEq(r.oldDirRemoved, true, 'old removed')
    assert(!existsSync(old), 'old gone')
    assertEq(readFileSync(join(new_, 'taskA', 'a.md'), 'utf-8'), 'A', 'A migrated')
    assertEq(readFileSync(join(new_, 'taskB', 'b.md'), 'utf-8'), 'B', 'B migrated')
  } finally { cleanup(root) }
})

test('merge: disjoint task dirs — all moved, old removed', () => {
  const { root, old, new_ } = freshRoot()
  try {
    seedFile(join(old, 'taskOld', 'old.md'), 'OLD')
    seedFile(join(new_, 'taskNew', 'new.md'), 'NEW')
    const r = migrateV127DiskDir(old, new_)
    assertEq(r.mode, 'merge', 'mode')
    assertEq(r.taskDirsMoved, 1, 'taskDirsMoved')
    assertEq(r.filesMoved, 0, 'filesMoved')
    assertEq(r.conflicts, 0, 'conflicts')
    assertEq(r.oldDirRemoved, true, 'old removed')
    assertEq(readFileSync(join(new_, 'taskOld', 'old.md'), 'utf-8'), 'OLD', 'old content moved')
    assertEq(readFileSync(join(new_, 'taskNew', 'new.md'), 'utf-8'), 'NEW', 'new content kept')
  } finally { cleanup(root) }
})

test('merge: same task, disjoint files — files merged into existing task dir', () => {
  const { root, old, new_ } = freshRoot()
  try {
    seedFile(join(old, 'taskShared', 'old-only.md'), 'OLD')
    seedFile(join(new_, 'taskShared', 'new-only.md'), 'NEW')
    const r = migrateV127DiskDir(old, new_)
    assertEq(r.mode, 'merge', 'mode')
    assertEq(r.taskDirsMoved, 0, 'taskDirsMoved')
    assertEq(r.filesMoved, 1, 'filesMoved')
    assertEq(r.conflicts, 0, 'conflicts')
    assertEq(readFileSync(join(new_, 'taskShared', 'old-only.md'), 'utf-8'), 'OLD', 'old file moved')
    assertEq(readFileSync(join(new_, 'taskShared', 'new-only.md'), 'utf-8'), 'NEW', 'new file kept')
  } finally { cleanup(root) }
})

test('merge: file collision — old kept in place, conflict counted, content NOT overwritten', () => {
  const { root, old, new_ } = freshRoot()
  try {
    seedFile(join(old, 'taskShared', 'same.md'), 'OLD-VERSION')
    seedFile(join(new_, 'taskShared', 'same.md'), 'NEW-VERSION')
    const r = migrateV127DiskDir(old, new_)
    assertEq(r.mode, 'merge', 'mode')
    assertEq(r.conflicts, 1, 'conflicts')
    assertEq(r.filesMoved, 0, 'filesMoved')
    assertEq(r.oldDirRemoved, false, 'old kept (non-empty)')
    assertEq(readFileSync(join(new_, 'taskShared', 'same.md'), 'utf-8'), 'NEW-VERSION', 'new not overwritten')
    assertEq(readFileSync(join(old, 'taskShared', 'same.md'), 'utf-8'), 'OLD-VERSION', 'old preserved for recovery')
  } finally { cleanup(root) }
})

test('merge: empty old dir → removed cleanly', () => {
  const { root, old, new_ } = freshRoot()
  try {
    mkdirSync(old, { recursive: true })
    seedFile(join(new_, 'taskA', 'file.md'), 'NEW')
    const r = migrateV127DiskDir(old, new_)
    assertEq(r.mode, 'merge', 'mode')
    assertEq(r.oldDirRemoved, true, 'empty old removed')
    assert(!existsSync(old), 'old gone')
  } finally { cleanup(root) }
})

test('idempotent: second call after successful rename is noop', () => {
  const { root, old, new_ } = freshRoot()
  try {
    seedFile(join(old, 'taskA', 'a.md'), 'A')
    migrateV127DiskDir(old, new_)
    const r2 = migrateV127DiskDir(old, new_)
    assertEq(r2.mode, 'noop', 'second call noop')
    assertEq(readFileSync(join(new_, 'taskA', 'a.md'), 'utf-8'), 'A', 'content intact')
  } finally { cleanup(root) }
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
