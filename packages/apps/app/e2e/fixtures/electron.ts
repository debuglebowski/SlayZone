import { test as base, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import path from 'path'
import fs from 'fs'

const APP_DIR = path.resolve(__dirname, '..', '..')
const MAIN_JS = path.join(APP_DIR, 'out', 'main', 'index.js')
const USER_DATA_DIR = path.join(APP_DIR, '.e2e-userdata')
export const TEST_PROJECT_PATH = path.join(APP_DIR, '.e2e-userdata', 'test-project')

// Shared state across all tests in the worker
let sharedApp: ElectronApplication
let sharedPage: Page

type ElectronFixtures = {
  electronApp: ElectronApplication
  mainWindow: Page
}

export const test = base.extend<ElectronFixtures>({
  electronApp: [
    async ({}, use) => {
      if (!sharedApp) {
        // Fresh user data for entire suite
        if (fs.existsSync(USER_DATA_DIR)) {
          fs.rmSync(USER_DATA_DIR, { recursive: true })
        }
        fs.mkdirSync(USER_DATA_DIR, { recursive: true })
        fs.mkdirSync(TEST_PROJECT_PATH, { recursive: true })

        sharedApp = await electron.launch({
          args: [MAIN_JS],
          executablePath: require('electron') as unknown as string,
          env: { ...process.env, PLAYWRIGHT: '1', SLAYZONE_DB_DIR: USER_DATA_DIR },
        })
      }
      await use(sharedApp)
    },
    { scope: 'worker' },
  ],

  mainWindow: [
    async ({ electronApp }, use) => {
      if (!sharedPage) {
        sharedPage = await resolveMainWindow(electronApp)
        // Resize the actual BrowserWindow so the app fills the viewport
        await electronApp.evaluate(({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.webContents.getURL() !== 'about:blank' && !w.webContents.getURL().startsWith('data:'))
          if (win) {
            win.setSize(1400, 900)
            win.center()
          }
        })
        // Dismiss onboarding if it appears
        const skip = sharedPage.getByRole('button', { name: 'Skip' })
        if (await skip.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await skip.click()
        }
      }
      await use(sharedPage)
    },
    { scope: 'worker' },
  ],
})

/**
 * The app opens a splash window (data: URL) before the main window (file:// URL).
 * Wait for the main window and its React root to mount.
 */
async function resolveMainWindow(app: ElectronApplication): Promise<Page> {
  const isMain = (url: string) => !url.startsWith('data:')

  for (const page of app.windows()) {
    if (isMain(page.url())) {
      await page.waitForSelector('#root', { timeout: 15_000 })
      return page
    }
  }

  return new Promise<Page>((resolve) => {
    app.on('window', async (page) => {
      if (isMain(page.url())) {
        await page.waitForSelector('#root', { timeout: 15_000 })
        resolve(page)
      }
    })
  })
}

/** Seed helpers — call window.api methods to create test data without UI interaction */
export function seed(page: Page) {
  return {
    createProject: (data: { name: string; color: string; path?: string }) =>
      page.evaluate((d) => window.api.db.createProject(d), data),

    createTask: (data: {
      projectId: string
      title: string
      status?: string
      priority?: number
      dueDate?: string
    }) => page.evaluate((d) => window.api.db.createTask(d), data),

    updateTask: (data: { id: string; status?: string; priority?: number; dueDate?: string | null }) =>
      page.evaluate((d) => window.api.db.updateTask(d), data),

    deleteTask: (id: string) => page.evaluate((i) => window.api.db.deleteTask(i), id),

    archiveTask: (id: string) => page.evaluate((i) => window.api.db.archiveTask(i), id),

    archiveTasks: (ids: string[]) => page.evaluate((i) => window.api.db.archiveTasks(i), ids),

    createTag: (data: { name: string; color?: string }) =>
      page.evaluate((d) => window.api.tags.createTag(d), data),

    updateTag: (data: { id: string; name?: string; color?: string }) =>
      page.evaluate((d) => window.api.tags.updateTag(d), data),

    deleteTag: (id: string) => page.evaluate((i) => window.api.tags.deleteTag(i), id),

    getTags: () => page.evaluate(() => window.api.tags.getTags()),

    setTagsForTask: (taskId: string, tagIds: string[]) =>
      page.evaluate(({ t, tags }) => window.api.taskTags.setTagsForTask(t, tags), {
        t: taskId,
        tags: tagIds,
      }),

    addBlocker: (taskId: string, blockerTaskId: string) =>
      page.evaluate(
        ({ t, b }) => window.api.taskDependencies.addBlocker(t, b),
        { t: taskId, b: blockerTaskId }
      ),

    getProjects: () => page.evaluate(() => window.api.db.getProjects()),

    getTasks: () => page.evaluate(() => window.api.db.getTasks()),

    updateProject: (data: { id: string; name?: string; color?: string; path?: string | null }) =>
      page.evaluate((d) => window.api.db.updateProject(d), data),

    deleteProject: (id: string) => page.evaluate((i) => window.api.db.deleteProject(i), id),

    deleteAllProjects: async () => {
      await page.evaluate(async () => {
        const projects = await window.api.db.getProjects()
        for (const p of projects) await window.api.db.deleteProject(p.id)
      })
    },

    setSetting: (key: string, value: string) =>
      page.evaluate(({ k, v }) => window.api.settings.set(k, v), { k: key, v: value }),

    getSetting: (key: string) => page.evaluate((k) => window.api.settings.get(k), key),

    setTheme: (theme: 'light' | 'dark' | 'system') =>
      page.evaluate((t) => window.api.theme.set(t), theme),

    /** Re-fetch all data from DB into React state */
    refreshData: () =>
      page.evaluate(async () => {
        await (window as any).__slayzone_refreshData?.()
        await new Promise((resolve) => setTimeout(resolve, 200))
      }),
  }
}

/** Scope selectors to the sidebar */
const sidebar = (page: Page) => page.locator('[data-slot="sidebar"]').first()

/** Click a project blob in the sidebar by its 2-letter abbreviation */
export async function clickProject(page: Page, abbrev: string) {
  await sidebar(page).getByText(abbrev, { exact: true }).click()
}

/** Click the "All" button in the sidebar */
export async function clickAll(page: Page) {
  await sidebar(page).locator('button[title="All projects"]').click()
}

/** Click the + button in the sidebar to add a project */
export async function clickAddProject(page: Page) {
  await sidebar(page).locator('button[title="Add project"]').click()
}

/** Click the settings button in the sidebar footer */
export async function clickSettings(page: Page) {
  // Settings button is in sidebar footer, has tooltip "Settings" but no title attr
  await sidebar(page).locator('[data-sidebar="footer"] button').last().click()
}

/** Navigate to home tab (div with lucide house/home icon, no title attr) */
export async function goHome(page: Page) {
  for (const sel of ['.lucide-house', '.lucide-home']) {
    const icon = page.locator(sel).first()
    if (await icon.isVisible({ timeout: 500 }).catch(() => false)) {
      await icon.click()
      return
    }
  }
}

/** Check if a project blob exists in the sidebar */
export function projectBlob(page: Page, abbrev: string) {
  return sidebar(page).getByText(abbrev, { exact: true })
}

export { expect } from '@playwright/test'
