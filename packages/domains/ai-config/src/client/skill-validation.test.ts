/**
 * Skill validation parser tests
 * Run with: npx tsx packages/domains/ai-config/src/client/skill-validation.test.ts
 */
import { repairSkillFrontmatter } from '../shared'
import { getSkillValidation } from './skill-validation'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
    passed += 1
  } catch (error) {
    console.log(`✗ ${name}`)
    console.error(`  ${error instanceof Error ? error.message : String(error)}`)
    failed += 1
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) throw new Error(`Expected ${String(actual)} to be ${String(expected)}`)
    }
  }
}

test('missing frontmatter is invalid', () => {
  const validation = getSkillValidation({
    type: 'skill',
    slug: 'x',
    content: '# body',
  })
  expect(validation?.status).toBe('invalid')
})

test('valid frontmatter content is valid', () => {
  const validation = getSkillValidation({
    type: 'skill',
    slug: 'x',
    content: '---\nname: x\ndescription: "a skill"\n---\n# body\n',
  })
  expect(validation?.status).toBe('valid')
})

test('missing description is invalid', () => {
  const validation = getSkillValidation({
    type: 'skill',
    slug: 'x',
    content: '---\nname: x\n---\n# body\n',
  })
  expect(validation?.status).toBe('invalid')
})

test('malformed frontmatter content is invalid', () => {
  const validation = getSkillValidation({
    type: 'skill',
    slug: 'broken',
    content: '---\nname: broken\ntags: [one, two\n---\n# body\n',
  })
  expect(validation?.status).toBe('invalid')
})

test('name mismatch produces a warning', () => {
  const validation = getSkillValidation({
    type: 'skill',
    slug: 'expected-slug',
    content: '---\nname: different-slug\ndescription: "a skill"\n---\n# body\n',
  })
  expect(validation?.status).toBe('warning')
})

test('multiline frontmatter content remains valid', () => {
  const validation = getSkillValidation({
    type: 'skill',
    slug: 'x',
    content: '---\nname: x\ndescription: |\n  line one\n  line two\n---\n# body\n',
  })
  expect(validation?.status).toBe('valid')
})

test('repairSkillFrontmatter adds a valid default block to body-only content', () => {
  const repaired = repairSkillFrontmatter('release-skill', 'Create a new release.\n')
  expect(repaired.startsWith('---\nname: release-skill\n')).toBe(true)
  expect(repaired.includes('trigger: auto')).toBe(true)
  expect(repaired.endsWith('\nCreate a new release.\n')).toBe(true)
})

test('repairSkillFrontmatter preserves body while fixing malformed documents', () => {
  const repaired = repairSkillFrontmatter('release-skill', '---\ndescription: Keep this\ntags: [one, two\n---\nBody\n')
  expect(repaired.includes('name: release-skill')).toBe(true)
  expect(repaired.includes('trigger: auto')).toBe(true)
  expect(repaired.includes('\nBody\n')).toBe(true)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
