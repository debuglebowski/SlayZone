/**
 * Panel config merge contract tests
 * Run with: npx tsx packages/domains/task/src/shared/panel-config.test.ts
 */
import type { PanelConfig } from './types.js'
import { mergePredefinedWebPanels } from './panel-config.js'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
    passed++
  } catch (error) {
    console.log(`✗ ${name}`)
    console.error(`  ${error instanceof Error ? error.message : String(error)}`)
    failed++
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) throw new Error(`Expected ${String(actual)} to be ${String(expected)}`)
    },
    toBeDefined() {
      if (actual === undefined) throw new Error('Expected value to be defined')
    },
  }
}

test('migrates legacy blocked panels to inferred handoff protocol and host scope', () => {
  const config: PanelConfig = {
    builtinEnabled: { 'web:legacy': true },
    webPanels: [
      {
        id: 'web:legacy',
        name: 'Legacy Figma',
        baseUrl: 'https://www.figma.com/file/123',
        blockDesktopHandoff: true,
      },
    ],
  }

  const merged = mergePredefinedWebPanels(config)
  const legacyPanel = merged.webPanels.find((panel) => panel.id === 'web:legacy')
  expect(legacyPanel).toBeDefined()
  expect(legacyPanel?.handoffProtocol).toBe('figma')
  expect(legacyPanel?.handoffHostScope).toBe('figma.com')
})

test('does not re-add deleted predefined panels', () => {
  const config: PanelConfig = {
    builtinEnabled: {},
    webPanels: [],
    deletedPredefined: ['web:figma'],
  }

  const merged = mergePredefinedWebPanels(config)
  const figmaPanel = merged.webPanels.find((panel) => panel.id === 'web:figma')
  expect(figmaPanel).toBe(undefined)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
