/**
 * Tests for shared rankByName helper.
 * Run with: pnpm exec tsx packages/domains/task-terminals/src/client/chat/autocomplete/ranking.test.ts
 */
import { rankByName } from './ranking'
import { transformCommandSubmit } from './sources/commands'
import type { CommandInfo } from '@slayzone/terminal/shared'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e instanceof Error ? e.message : e}`)
    failed++
  }
}

function assertEqual<T>(actual: T, expected: T, label?: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label ?? 'values'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    )
  }
}

interface TestItem {
  name: string
  description: string
}

const pool: TestItem[] = [
  { name: 'caveman', description: 'terse' },
  { name: 'caveman-commit', description: 'commit' },
  { name: 'commit', description: 'plain commit' },
  { name: 'unrelated', description: 'has caveman in desc' },
]

console.log('\nrankByName')

test('empty query — alphabetical', () => {
  const out = rankByName(pool, '', { getName: (i) => i.name })
  assertEqual(out[0].name, 'caveman')
  assertEqual(out[1].name, 'caveman-commit')
  assertEqual(out[2].name, 'commit')
  assertEqual(out[3].name, 'unrelated')
})

test('prefix > substring > description', () => {
  const out = rankByName(pool, 'cave', {
    getName: (i) => i.name,
    getDescription: (i) => i.description,
  })
  assertEqual(out[0].name, 'caveman')
  assertEqual(out[out.length - 1].name, 'unrelated')
})

test('no description accessor — description matches excluded', () => {
  const out = rankByName(pool, 'cave', { getName: (i) => i.name })
  assertEqual(out.find((i) => i.name === 'unrelated'), undefined)
})

test('alphabetical tiebreak in same score bucket', () => {
  const out = rankByName(pool, 'caveman-', { getName: (i) => i.name })
  assertEqual(out[0].name, 'caveman-commit')
})

test('fuzzy match — non-contiguous chars', () => {
  const out = rankByName(pool, 'cmt', { getName: (i) => i.name })
  // 'commit' and 'caveman-commit' both contain c…m…t fuzzily
  assertEqual(out.some((i) => i.name === 'commit'), true)
  assertEqual(out.some((i) => i.name === 'caveman-commit'), true)
})

test('fuzzy match — case-insensitive', () => {
  const out = rankByName(pool, 'CAVE', { getName: (i) => i.name })
  assertEqual(out[0].name, 'caveman')
})

console.log('\ntransformCommandSubmit')

function cmd(name: string, body: string): CommandInfo {
  return { name, description: '', source: 'user', path: `/tmp/${name}.md`, body }
}

test('returns null when draft does not start with /', () => {
  assertEqual(transformCommandSubmit('hello', [cmd('x', 'body')]), null)
})

test('returns null when no cmd matches', () => {
  assertEqual(transformCommandSubmit('/unknown args', [cmd('x', 'body')]), null)
})

test('expands $ARGUMENTS with rest-of-line', () => {
  const r = transformCommandSubmit('/review https://github.com/pr/1', [
    cmd('review', 'Review PR: $ARGUMENTS'),
  ])
  assertEqual(r?.send, 'Review PR: https://github.com/pr/1')
})

test('empty args expand to empty string', () => {
  const r = transformCommandSubmit('/review', [cmd('review', 'Do $ARGUMENTS')])
  assertEqual(r?.send, 'Do')
})

test('returns body unchanged when no $ARGUMENTS placeholder', () => {
  const r = transformCommandSubmit('/commit', [cmd('commit', 'Please commit staged files.')])
  assertEqual(r?.send, 'Please commit staged files.')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
