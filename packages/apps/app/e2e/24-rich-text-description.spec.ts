import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Rich text description', () => {
  let projectAbbrev: string
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'RichText Test', color: '#ec4899', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    const t = await s.createTask({ projectId: p.id, title: 'Editor task', status: 'todo' })
    taskId = t.id
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)

    // Open task detail
    await mainWindow.getByText('Editor task').first().click()
    await mainWindow.waitForTimeout(500)
  })

  /** The TipTap contenteditable editor in the settings panel */
  const editor = (page: import('@playwright/test').Page) =>
    page.locator('[contenteditable="true"]').first()

  test('editor shows placeholder', async ({ mainWindow }) => {
    // TipTap placeholder rendered as CSS ::before or data attribute
    const ed = editor(mainWindow)
    await expect(ed).toBeVisible()
    // Empty editor should have placeholder class/attribute
    const text = await ed.textContent()
    expect(text?.trim()).toBe('')
  })

  test('type plain text', async ({ mainWindow }) => {
    const ed = editor(mainWindow)
    await ed.click()
    await mainWindow.keyboard.type('Hello world')

    await expect(ed).toContainText('Hello world')
  })

  test('save on blur persists to DB', async ({ mainWindow }) => {
    // Click outside editor to blur
    await mainWindow.locator('body').click({ position: { x: 10, y: 10 } })
    await mainWindow.waitForTimeout(500)

    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.description).toContain('Hello world')
  })

  test('bold formatting via Cmd+B', async ({ mainWindow }) => {
    const ed = editor(mainWindow)
    await ed.click()
    // Move cursor to end of document
    await mainWindow.keyboard.press('Meta+ArrowDown')
    await mainWindow.keyboard.type(' ')

    // Type bold text
    await mainWindow.keyboard.press('Meta+b')
    await mainWindow.keyboard.type('bold text')
    await mainWindow.keyboard.press('Meta+b')

    // Blur to save
    await mainWindow.locator('body').click({ position: { x: 10, y: 10 } })
    await mainWindow.waitForTimeout(500)

    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.description).toContain('<strong>bold text</strong>')
  })

  test('italic formatting via Cmd+I', async ({ mainWindow }) => {
    const ed = editor(mainWindow)
    await ed.click()
    await mainWindow.keyboard.press('Meta+ArrowDown')
    await mainWindow.keyboard.type(' ')

    await mainWindow.keyboard.press('Meta+i')
    await mainWindow.keyboard.type('italic text')
    await mainWindow.keyboard.press('Meta+i')

    await mainWindow.locator('body').click({ position: { x: 10, y: 10 } })
    await mainWindow.waitForTimeout(500)

    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.description).toContain('<em>italic text</em>')
  })

  test('bullet list via Cmd+Shift+8', async ({ mainWindow }) => {
    const ed = editor(mainWindow)
    await ed.click()
    // Move to end then new line + toggle bullet list
    await mainWindow.keyboard.press('Meta+ArrowDown')
    await mainWindow.keyboard.press('Enter')
    await mainWindow.keyboard.press('Meta+Shift+8')
    await mainWindow.keyboard.type('List item one')
    await mainWindow.keyboard.press('Enter')
    await mainWindow.keyboard.type('List item two')

    await mainWindow.locator('body').click({ position: { x: 10, y: 10 } })
    await mainWindow.waitForTimeout(500)

    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.description).toContain('<ul>')
    expect(task?.description).toContain('List item one')
    expect(task?.description).toContain('List item two')
  })

  test('content persists across navigation', async ({ mainWindow }) => {
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(300)

    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(300)
    await mainWindow.getByText('Editor task').first().click()
    await mainWindow.waitForTimeout(500)

    const ed = editor(mainWindow)
    await expect(ed).toContainText('Hello world')
    await expect(ed).toContainText('bold text')
    await expect(ed).toContainText('italic text')
    await expect(ed).toContainText('List item one')
  })

  test('escape blurs editor', async ({ mainWindow }) => {
    const ed = editor(mainWindow)
    await ed.click()
    // Editor should be focused
    await expect(ed).toBeFocused()

    await mainWindow.keyboard.press('Escape')
    await mainWindow.waitForTimeout(200)

    // Editor should no longer be focused
    await expect(ed).not.toBeFocused()
  })
})
