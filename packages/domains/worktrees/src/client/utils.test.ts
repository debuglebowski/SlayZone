/**
 * Tests for utils.ts
 * Run with: npx tsx packages/domains/worktrees/src/client/utils.test.ts
 */
import {
  DEFAULT_WORKTREE_BASE_PATH_TEMPLATE,
  resolveWorktreeBasePathTemplate,
  slugify
} from './utils'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`✗ ${name}`)
    console.error(`  ${e}`)
    failed++
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    }
  }
}

test('basic title case', () => {
  expect(slugify('Fix Login Bug')).toBe('fix-login-bug')
})

test('already lowercase', () => {
  expect(slugify('hello world')).toBe('hello-world')
})

test('special characters stripped', () => {
  expect(slugify('fix: login (bug) #123')).toBe('fix-login-bug-123')
})

test('underscores become hyphens', () => {
  expect(slugify('some_task_name')).toBe('some-task-name')
})

test('consecutive spaces collapsed', () => {
  expect(slugify('too   many   spaces')).toBe('too-many-spaces')
})

test('consecutive hyphens collapsed', () => {
  expect(slugify('a---b---c')).toBe('a-b-c')
})

test('leading and trailing spaces trimmed', () => {
  expect(slugify('  padded  ')).toBe('padded')
})

test('leading and trailing hyphens trimmed', () => {
  expect(slugify('-leading-and-trailing-')).toBe('leading-and-trailing')
})

test('empty string', () => {
  expect(slugify('')).toBe('')
})

test('only special characters', () => {
  expect(slugify('!@#$%^&*()')).toBe('')
})

test('mixed underscores spaces hyphens', () => {
  expect(slugify('a_b c-d')).toBe('a-b-c-d')
})

test('unicode letters stripped', () => {
  // \w in JS matches [a-zA-Z0-9_] — unicode accented chars are stripped
  expect(slugify('café résumé')).toBe('caf-rsum')
})

test('numbers preserved', () => {
  expect(slugify('Task 42 is great')).toBe('task-42-is-great')
})

test('all caps', () => {
  expect(slugify('ALL CAPS TITLE')).toBe('all-caps-title')
})

test('default template constant', () => {
  expect(DEFAULT_WORKTREE_BASE_PATH_TEMPLATE).toBe('{project}/..')
})

test('resolve {project} token (posix)', () => {
  expect(resolveWorktreeBasePathTemplate('{project}/..', '/Users/kalle/dev/slayzone')).toBe('/Users/kalle/dev/slayzone/..')
})

test('resolve {project} token trims trailing slash', () => {
  expect(resolveWorktreeBasePathTemplate('{project}/..', '/Users/kalle/dev/slayzone/')).toBe('/Users/kalle/dev/slayzone/..')
})

test('resolve {project} token (windows)', () => {
  expect(resolveWorktreeBasePathTemplate('{project}\\..', 'C:\\Users\\kalle\\dev\\slayzone')).toBe('C:\\Users\\kalle\\dev\\slayzone\\..')
})

test('template without token is returned unchanged', () => {
  expect(resolveWorktreeBasePathTemplate('/tmp/worktrees', '/Users/kalle/dev/slayzone')).toBe('/tmp/worktrees')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
