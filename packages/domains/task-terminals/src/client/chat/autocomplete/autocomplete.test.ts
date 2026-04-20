/**
 * Tests for autocomplete source detectors + file `@` trigger.
 * Run with: pnpm exec tsx packages/domains/task-terminals/src/client/chat/autocomplete/autocomplete.test.ts
 */
import { createSkillsSource } from './sources/skills'
import { createFilesSource } from './sources/files'
import { expandCommandBody } from './sources/commands'
import { filterBuiltins } from './builtins-registry'
import { spliceReplace } from './useAutocomplete'

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
    throw new Error(`${label ?? 'values'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

console.log('\nskills source — detect')
const skills = createSkillsSource()

test('triggers at start-of-line `/`', () => {
  const m = skills.detect('/cave', 5)
  assertEqual(m?.query, 'cave')
  assertEqual(m?.tokenStart, 0)
  assertEqual(m?.tokenEnd, 5)
})

test('no trigger without leading `/`', () => {
  assertEqual(skills.detect('hello', 5), null)
})

test('no trigger when space after `/cmd`', () => {
  assertEqual(skills.detect('/cmd ', 5), null)
})

console.log('\nfiles source — detect')
const files = createFilesSource()

test('triggers on `@` at start', () => {
  const m = files.detect('@src/', 5)
  assertEqual(m?.query, 'src/')
  assertEqual(m?.tokenStart, 0)
})

test('triggers on `@` after space', () => {
  const m = files.detect('hey @src', 8)
  assertEqual(m?.query, 'src')
  assertEqual(m?.tokenStart, 4)
})

test('no trigger on `email@addr`', () => {
  assertEqual(files.detect('email@addr', 10), null)
})

test('no trigger on plain text', () => {
  assertEqual(files.detect('hello world', 11), null)
})

console.log('\nspliceReplace')

test('replaces token in middle', () => {
  const out = spliceReplace('hey @src world', 4, 8, '@src/App.tsx')
  assertEqual(out, 'hey @src/App.tsx world')
})

test('replaces token at start', () => {
  const out = spliceReplace('/cave', 0, 5, '/caveman ')
  assertEqual(out, '/caveman ')
})

console.log('\nexpandCommandBody')

test('replaces $ARGUMENTS with args text', () => {
  const out = expandCommandBody('Review PR: $ARGUMENTS', 'https://example.com/pr/1')
  assertEqual(out, 'Review PR: https://example.com/pr/1')
})

test('replaces multiple $ARGUMENTS tokens', () => {
  const out = expandCommandBody('$ARGUMENTS and $ARGUMENTS', 'x')
  assertEqual(out, 'x and x')
})

test('empty args still substitutes (caller trims)', () => {
  assertEqual(expandCommandBody('Do $ARGUMENTS', ''), 'Do ')
})

console.log('\nbuiltins filter')

test('empty query returns all', () => {
  assertEqual(filterBuiltins('').length > 0, true)
})

test('prefix match ranked above description match', () => {
  const out = filterBuiltins('clear')
  assertEqual(out[0].name, 'clear')
})

test('no match returns empty', () => {
  assertEqual(filterBuiltins('zzzz-none').length, 0)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
