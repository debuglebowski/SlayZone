import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import fs from 'fs'
import path from 'path'

test.describe('File editor', () => {
  let projectAbbrev: string

  /** The editor panel wrapper (bg-surface-1 rounded-md, contains "Files" heading) */
  const editorPanel = (page: import('@playwright/test').Page) =>
    page.locator('.rounded-md.bg-surface-1:visible').filter({ hasText: 'Files' })

  /** File tree entry by name (tree buttons have w-full, tab buttons don't) */
  const treeFile = (page: import('@playwright/test').Page, name: string) =>
    editorPanel(page).locator(`button.w-full:has-text("${name}")`).first()

  /** Editor tab by filename (tab buttons have title=filePath) */
  const editorTab = (page: import('@playwright/test').Page, name: string) =>
    page.locator(`button[title$="${name}"]:visible`).first()

  test.beforeAll(async ({ mainWindow }) => {
    // Create test files in the test project directory
    fs.writeFileSync(path.join(TEST_PROJECT_PATH, 'hello.ts'), 'export const hello = "world"\n')
    fs.writeFileSync(path.join(TEST_PROJECT_PATH, 'readme.md'), '# Test\n\nA test file.\n')
    fs.mkdirSync(path.join(TEST_PROJECT_PATH, 'src'), { recursive: true })
    fs.writeFileSync(path.join(TEST_PROJECT_PATH, 'src', 'index.ts'), 'console.log("hi")\n')
    // Create a .gitignore
    fs.writeFileSync(path.join(TEST_PROJECT_PATH, '.gitignore'), 'node_modules\ndist\n*.log\n')
    // Create an ignored directory
    fs.mkdirSync(path.join(TEST_PROJECT_PATH, 'node_modules'), { recursive: true })
    fs.writeFileSync(path.join(TEST_PROJECT_PATH, 'node_modules', 'pkg.json'), '{}')
    fs.mkdirSync(path.join(TEST_PROJECT_PATH, 'dist'), { recursive: true })
    fs.writeFileSync(path.join(TEST_PROJECT_PATH, 'dist', 'bundle.js'), '')

    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'FEditor Test', color: '#10b981', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    const t = await s.createTask({ projectId: p.id, title: 'Editor test task', status: 'todo' })
    await s.refreshData()

    // Navigate to task
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)
    await mainWindow.getByText('Editor test task').first().click()
    await mainWindow.waitForTimeout(500)

    // Toggle editor panel on via Cmd+E
    await mainWindow.keyboard.press('Meta+e')
    await mainWindow.waitForTimeout(500)
  })

  // --- .gitignore awareness ---

  test('editor panel is visible with file tree', async ({ mainWindow }) => {
    // Editor button in PanelToggle should have active class (bg-muted)
    const btn = mainWindow.locator('.bg-surface-2.rounded-lg:visible').locator('button:has-text("Editor")')
    await expect(btn).toHaveClass(/bg-muted/)
    await expect(editorPanel(mainWindow).getByText('Files')).toBeVisible()
  })

  test('file tree shows project files', async ({ mainWindow }) => {
    await expect(treeFile(mainWindow, 'hello.ts')).toBeVisible({ timeout: 5_000 })
    await expect(treeFile(mainWindow, 'readme.md')).toBeVisible()
    await expect(treeFile(mainWindow, 'src')).toBeVisible()
  })

  test('file tree respects .gitignore — node_modules and dist hidden', async ({ mainWindow }) => {
    // node_modules and dist should be filtered by .gitignore
    await expect(editorPanel(mainWindow).getByText('node_modules')).not.toBeVisible()
    await expect(editorPanel(mainWindow).getByText('dist')).not.toBeVisible()
  })

  test('.gitignore itself is visible (not ignored)', async ({ mainWindow }) => {
    await expect(treeFile(mainWindow, '.gitignore')).toBeVisible()
  })

  // --- Open file + tabs ---

  test('clicking a file opens it in editor with tab', async ({ mainWindow }) => {
    await treeFile(mainWindow, 'hello.ts').click()
    await mainWindow.waitForTimeout(300)

    // Tab should appear
    await expect(editorTab(mainWindow, 'hello.ts')).toBeVisible()
    // CodeMirror should render
    await expect(mainWindow.locator('.cm-editor:visible .cm-content')).toBeVisible()
  })

  test('opening another file creates a second tab', async ({ mainWindow }) => {
    await treeFile(mainWindow, 'readme.md').click()
    await mainWindow.waitForTimeout(300)

    await expect(editorTab(mainWindow, 'hello.ts')).toBeVisible()
    await expect(editorTab(mainWindow, 'readme.md')).toBeVisible()
  })

  // --- Large file guard ---

  test('large file shows "too large" message', async ({ mainWindow }) => {
    // Create a file > 1MB
    const largePath = path.join(TEST_PROJECT_PATH, 'large.txt')
    fs.writeFileSync(largePath, 'x'.repeat(1.5 * 1024 * 1024))

    // Wait for watcher to detect new file and refresh tree
    await mainWindow.waitForTimeout(2000)

    await expect(treeFile(mainWindow, 'large.txt')).toBeVisible({ timeout: 5_000 })
    await treeFile(mainWindow, 'large.txt').click()
    await mainWindow.waitForTimeout(300)

    await expect(mainWindow.getByText('File too large').first()).toBeVisible({ timeout: 5_000 })
    await expect(mainWindow.getByRole('button', { name: 'Open anyway' }).first()).toBeVisible()

    // Clean up
    fs.unlinkSync(largePath)
  })

  test('"Open anyway" bypasses size limit', async ({ mainWindow }) => {
    // Create a file just over 1MB but under 10MB
    const mediumPath = path.join(TEST_PROJECT_PATH, 'medium.txt')
    const content = 'hello '.repeat(200_000) // ~1.2MB
    fs.writeFileSync(mediumPath, content)

    // Wait for watcher to detect new file and refresh tree
    await mainWindow.waitForTimeout(2000)

    await expect(treeFile(mainWindow, 'medium.txt')).toBeVisible({ timeout: 5_000 })
    await treeFile(mainWindow, 'medium.txt').click()
    await mainWindow.waitForTimeout(300)

    await expect(mainWindow.getByText('File too large').first()).toBeVisible({ timeout: 5_000 })
    await mainWindow.getByRole('button', { name: 'Open anyway' }).first().click()
    await mainWindow.waitForTimeout(500)

    // Should now show CodeMirror editor
    await expect(mainWindow.locator('.cm-editor:visible')).toBeVisible({ timeout: 5_000 })

    fs.unlinkSync(mediumPath)
  })

  // --- Dirty indicator ---

  test('editing a file shows dirty indicator dot on tab', async ({ mainWindow }) => {
    // Open hello.ts via tree (ensures tab is active even if prior tests changed state)
    await treeFile(mainWindow, 'hello.ts').click()
    await mainWindow.waitForTimeout(300)

    // Type something in the CodeMirror editor
    await mainWindow.locator('.cm-editor:visible .cm-content').click()
    await mainWindow.keyboard.type('// modified')
    await mainWindow.waitForTimeout(300)

    // Dirty dot should appear (conditionally rendered — check DOM presence)
    const tab = editorTab(mainWindow, 'hello.ts')
    await expect(tab.locator('.rounded-full')).toHaveCount(1)
  })

  // --- Unsaved changes warning ---

  test('closing dirty tab shows unsaved changes dialog', async ({ mainWindow }) => {
    // hello.ts is dirty from previous test — close it
    const tab = editorTab(mainWindow, 'hello.ts')
    // Hover to reveal close button, then click X
    await tab.hover()
    await mainWindow.waitForTimeout(100)
    await tab.locator('.lucide-x').click()
    await mainWindow.waitForTimeout(300)

    // AlertDialog should appear
    await expect(mainWindow.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible({ timeout: 3_000 })
    await expect(mainWindow.getByText('hello.ts has unsaved changes')).toBeVisible()

    // Cancel — should keep the tab open
    await mainWindow.getByRole('button', { name: 'Cancel' }).click()
    await mainWindow.waitForTimeout(200)
    await expect(editorTab(mainWindow, 'hello.ts')).toBeVisible()
  })

  test('discard closes dirty tab without saving', async ({ mainWindow }) => {
    const tab = editorTab(mainWindow, 'hello.ts')
    await tab.hover()
    await mainWindow.waitForTimeout(100)
    await tab.locator('.lucide-x').click()
    await mainWindow.waitForTimeout(300)

    await mainWindow.getByRole('button', { name: 'Discard' }).click()
    await mainWindow.waitForTimeout(300)

    // Tab should be gone
    await expect(editorTab(mainWindow, 'hello.ts')).not.toBeVisible()

    // File on disk should be unchanged
    const content = fs.readFileSync(path.join(TEST_PROJECT_PATH, 'hello.ts'), 'utf-8')
    expect(content).toBe('export const hello = "world"\n')
  })

  // --- External file change detection ---

  test('external file change reloads clean file in editor', async ({ mainWindow }) => {
    // Open hello.ts fresh
    await treeFile(mainWindow, 'hello.ts').click()
    await mainWindow.waitForTimeout(500)

    // Modify file on disk externally
    fs.writeFileSync(path.join(TEST_PROJECT_PATH, 'hello.ts'), 'export const hello = "changed"\n')

    // Wait for watcher to detect + debounce + reload
    await mainWindow.waitForTimeout(1500)

    // The editor should now contain the new content
    const editorContent = await mainWindow.locator('.cm-editor:visible .cm-content').textContent()
    expect(editorContent).toContain('changed')

    // Restore original
    fs.writeFileSync(path.join(TEST_PROJECT_PATH, 'hello.ts'), 'export const hello = "world"\n')
  })

  test('external change on dirty file shows "changed" indicator', async ({ mainWindow }) => {
    // Open hello.ts, make it dirty
    await treeFile(mainWindow, 'hello.ts').click()
    await mainWindow.waitForTimeout(300)
    await mainWindow.locator('.cm-editor:visible .cm-content').click()
    await mainWindow.keyboard.type('// dirty edit')
    await mainWindow.waitForTimeout(300)

    // Modify file on disk externally
    fs.writeFileSync(path.join(TEST_PROJECT_PATH, 'hello.ts'), 'export const hello = "disk change"\n')

    // Wait for watcher
    await mainWindow.waitForTimeout(1500)

    // Should show "changed" label on the tab (not auto-reload because dirty)
    await expect(editorTab(mainWindow, 'hello.ts').getByText('changed')).toBeVisible({ timeout: 5_000 })

    // Discard the tab to clean up
    const tab = editorTab(mainWindow, 'hello.ts')
    await tab.hover()
    await mainWindow.waitForTimeout(100)
    await tab.locator('.lucide-x').click()
    await mainWindow.waitForTimeout(200)
    await mainWindow.getByRole('button', { name: 'Discard' }).click()
    await mainWindow.waitForTimeout(200)

    // Restore original
    fs.writeFileSync(path.join(TEST_PROJECT_PATH, 'hello.ts'), 'export const hello = "world"\n')
  })

  test('new file created externally appears in tree', async ({ mainWindow }) => {
    // Create a new file
    fs.writeFileSync(path.join(TEST_PROJECT_PATH, 'newfile.ts'), 'export const x = 1\n')

    // Wait for watcher + tree refresh debounce
    await mainWindow.waitForTimeout(2000)

    await expect(treeFile(mainWindow, 'newfile.ts')).toBeVisible({ timeout: 5_000 })

    fs.unlinkSync(path.join(TEST_PROJECT_PATH, 'newfile.ts'))
  })

  // --- Quick open (Cmd+P) ---

  test('Cmd+P opens quick open dialog', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+p')
    await mainWindow.waitForTimeout(500)

    // Should see the dialog with search input
    await expect(mainWindow.getByPlaceholder('Open file by name...')).toBeVisible({ timeout: 3_000 })

    // Should list project files
    await expect(mainWindow.locator('[cmdk-item]').first()).toBeVisible({ timeout: 5_000 })

    // Close dialog
    await mainWindow.keyboard.press('Escape')
    await mainWindow.waitForTimeout(200)
  })

  test('quick open filters files by query', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+p')
    await mainWindow.waitForTimeout(500)

    const input = mainWindow.getByPlaceholder('Open file by name...')
    await input.fill('hello')
    await mainWindow.waitForTimeout(300)

    // Should show hello.ts
    await expect(mainWindow.locator('[cmdk-item]').filter({ hasText: 'hello.ts' })).toBeVisible()

    // Close
    await mainWindow.keyboard.press('Escape')
    await mainWindow.waitForTimeout(200)
  })

  test('quick open does not show gitignored files', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+p')
    await mainWindow.waitForTimeout(500)

    const input = mainWindow.getByPlaceholder('Open file by name...')
    await input.fill('pkg.json')
    await mainWindow.waitForTimeout(300)

    // Should show "No files found" since node_modules/pkg.json is gitignored
    await expect(mainWindow.getByText('No files found.')).toBeVisible()

    await mainWindow.keyboard.press('Escape')
    await mainWindow.waitForTimeout(200)
  })

  test('selecting a file in quick open opens it', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+p')
    await mainWindow.waitForTimeout(500)

    const input = mainWindow.getByPlaceholder('Open file by name...')
    await input.fill('index.ts')
    await mainWindow.waitForTimeout(300)

    // Select the first match
    await mainWindow.locator('[cmdk-item]').filter({ hasText: 'index.ts' }).first().click()
    await mainWindow.waitForTimeout(300)

    // Tab should appear for src/index.ts
    await expect(editorTab(mainWindow, 'index.ts')).toBeVisible()
  })

  // --- Cmd+S save ---

  test('Cmd+S saves the file', async ({ mainWindow }) => {
    // Open hello.ts via tree and edit it
    await treeFile(mainWindow, 'hello.ts').click()
    await mainWindow.waitForTimeout(300)
    await mainWindow.locator('.cm-editor:visible .cm-content').click()

    // Select all and replace
    await mainWindow.keyboard.press('Meta+a')
    await mainWindow.keyboard.type('export const hello = "saved"\n')
    await mainWindow.waitForTimeout(200)

    // Dirty indicator should exist (conditionally rendered)
    await expect(editorTab(mainWindow, 'hello.ts').locator('.rounded-full')).toHaveCount(1)

    // Save with Cmd+S (CodeMirror intercepts this)
    await mainWindow.keyboard.press('Meta+s')
    await mainWindow.waitForTimeout(500)

    // Dirty indicator should be gone
    await expect(editorTab(mainWindow, 'hello.ts').locator('.rounded-full')).toHaveCount(0)

    // File on disk should be updated
    const content = fs.readFileSync(path.join(TEST_PROJECT_PATH, 'hello.ts'), 'utf-8')
    expect(content).toContain('saved')

    // Restore
    fs.writeFileSync(path.join(TEST_PROJECT_PATH, 'hello.ts'), 'export const hello = "world"\n')
  })
})
