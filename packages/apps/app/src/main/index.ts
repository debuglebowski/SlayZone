import { app, shell, BrowserWindow, ipcMain, nativeTheme, session, webContents, dialog, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// Use consistent app name for userData path (paired with legacy DB migration)
app.name = 'slayzone'
const isPlaywright = process.env.PLAYWRIGHT === '1'

// Enable remote debugging for MCP server (dev only, skip when Playwright drives the app)
if (is.dev && !isPlaywright) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}
import icon from '../../resources/icon.png?asset'
import { getDatabase, closeDatabase } from './db'
// Domain handlers
import { registerProjectHandlers } from '@slayzone/projects/main'
import { registerTaskHandlers, registerAiHandlers, registerFilesHandlers } from '@slayzone/task/main'
import { registerTagHandlers } from '@slayzone/tags/main'
import { registerSettingsHandlers, registerThemeHandlers } from '@slayzone/settings/main'
import { registerPtyHandlers, registerClaudeHandlers, killAllPtys, startIdleChecker, stopIdleChecker } from '@slayzone/terminal/main'
import { registerTerminalTabsHandlers } from '@slayzone/task-terminals/main'
import { registerWorktreeHandlers } from '@slayzone/worktrees/main'
import { registerDiagnosticsHandlers, registerProcessDiagnostics, stopDiagnostics } from '@slayzone/diagnostics/main'
import { registerAiConfigHandlers } from '@slayzone/ai-config/main'
import { registerIntegrationHandlers, startLinearSyncPoller } from '@slayzone/integrations/main'

// Minimum splash screen display time (ms)
const SPLASH_MIN_DURATION = 4000
const DEFAULT_WINDOW_WIDTH = 1760
const DEFAULT_WINDOW_HEIGHT = 1280

// Self-contained splash HTML with inline SVG and CSS animations
const splashHTML = (version: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      height: 100%;
      overflow: hidden;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .container {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #0a0a0a;
      border-radius: 16px;
      position: relative;
    }
    .logo-wrapper {
      animation: fadeInScale 0.4s ease-out forwards;
    }
    .logo {
      width: 80px;
      height: 80px;
    }
    .title {
      margin-top: 24px;
      font-size: 28px;
      font-weight: 600;
      color: #fafafa;
      display: inline-flex;
      align-items: center;
    }
    .typed-text {
      white-space: pre;
    }
    .caret {
      display: inline-block;
      width: 2px;
      height: 1.1em;
      margin-left: 6px;
      background: #fafafa;
      animation: blink 0.9s step-end infinite;
    }
    .version {
      position: absolute;
      bottom: 24px;
      font-size: 12px;
      color: #525252;
      opacity: 0;
      animation: fadeIn 0.15s ease-out 0.3s forwards;
    }
    @keyframes fadeInScale {
      from { opacity: 0; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes blink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0; }
    }
    .fade-out {
      animation: fadeOut 0.3s ease-out forwards;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-wrapper">
      <svg class="logo" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="crown-graffiti" x1="6" y1="10" x2="58" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#00E5FF"/>
            <stop offset="0.35" stop-color="#FF3CAC"/>
            <stop offset="0.7" stop-color="#FFD500"/>
            <stop offset="1" stop-color="#39FF14"/>
          </linearGradient>
          <filter id="soft-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path
          d="M8,48 L14,24 L24,36 L32,16 L40,36 L50,24 L56,48 Z"
          stroke="url(#crown-graffiti)"
          stroke-width="5.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
          filter="url(#soft-glow)"
        />
      </svg>
    </div>
    <div class="title">
      <span class="typed-text" aria-hidden="true"></span>
      <span class="caret" aria-hidden="true"></span>
    </div>
    <div class="version">v${version}</div>
  </div>
  <script>
    const typedText = document.querySelector('.typed-text')
    const first = 'Breath...'
    const second = 'then slay'
    const TYPE_MS = 90
    const ERASE_MS = 60
    const PAUSE_BEFORE_START = 500
    const PAUSE_AFTER_FIRST = 600
    const PAUSE_AFTER_ERASE = 250

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    const typeText = async (text) => {
      for (let i = 0; i < text.length; i += 1) {
        typedText.textContent += text[i]
        await sleep(TYPE_MS)
      }
    }

    const eraseText = async () => {
      while (typedText.textContent.length > 0) {
        typedText.textContent = typedText.textContent.slice(0, -1)
        await sleep(ERASE_MS)
      }
    }

    const runSequence = async () => {
      await sleep(PAUSE_BEFORE_START)
      await typeText(first)
      await sleep(PAUSE_AFTER_FIRST)
      await eraseText()
      await sleep(PAUSE_AFTER_ERASE)
      await typeText(second)
    }

    window.addEventListener('DOMContentLoaded', () => {
      runSequence()
    })
  </script>
</body>
</html>
`

let splashWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null
let splashShownAt: number = 0
let linearSyncPoller: NodeJS.Timeout | null = null

function emitOpenSettings(): void {
  mainWindow?.webContents.send('app:open-settings')
}

function emitOpenProjectSettings(): void {
  mainWindow?.webContents.send('app:open-project-settings')
}

function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    resizable: false,
    center: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML(app.getVersion()))}`)

  splashWindow.once('ready-to-show', () => {
    splashShownAt = Date.now()
    splashWindow?.show()
  })

  splashWindow.on('closed', () => {
    splashWindow = null
  })
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    show: false,
    center: true,
    title: 'SlayZone',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0a0a0a',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true // Required for <webview> in Work Mode browser tabs
    }
  })

  mainWindow.on('ready-to-show', () => {
    // In Playwright mode we skip splash entirely and show immediately.
    const remaining =
      splashWindow && !splashWindow.isDestroyed()
        ? Math.max(0, SPLASH_MIN_DURATION - (Date.now() - splashShownAt))
        : 0

    // Start the idle checker for terminal hibernation
    if (mainWindow) {
      startIdleChecker(mainWindow)
    }

    setTimeout(() => {
      // Position main window exactly where splash is
      if (splashWindow && !splashWindow.isDestroyed()) {
        const bounds = splashWindow.getBounds()
        mainWindow?.setBounds(bounds)
      }
      // Show main window first (splash stays on top due to alwaysOnTop)
      // In Playwright mode, keep window hidden to avoid focus stealing during tests
      if (!isPlaywright) mainWindow?.show()
      // Fade out splash, then close it
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents
          .executeJavaScript(`document.querySelector('.container').classList.add('fade-out')`)
          .then(() => {
            // Wait for fade animation to complete (300ms), then close
            setTimeout(() => {
              if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.close()
              }
            }, 300)
          })
          .catch(() => {
            // Fallback: just close if JS execution fails
            splashWindow?.close()
          })
      }
    }, remaining)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Intercept Cmd+§ at Electron level (react-hotkeys-hook doesn't recognize §)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === '§' && input.meta) {
      event.preventDefault()
      mainWindow?.webContents.send('app:go-home')
      return
    }

    if (input.type === 'keyDown' && input.key === ',' && input.meta && input.shift) {
      event.preventDefault()
      emitOpenProjectSettings()
      return
    }

    if (input.type === 'keyDown' && input.key === ',' && input.meta) {
      event.preventDefault()
      emitOpenSettings()
    }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createWindow(): void {
  if (!isPlaywright) {
    createSplashWindow()
  }
  createMainWindow()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Initialize database
  const db = getDatabase()
  registerProcessDiagnostics(app)

  // Load and apply persisted theme BEFORE creating window to prevent flash
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('theme') as
    | { value: string }
    | undefined
  const savedTheme = row?.value as 'light' | 'dark' | 'system' | undefined
  if (savedTheme) {
    nativeTheme.themeSource = savedTheme
  }

  // Set dock icon on macOS (needed for dev mode)
  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon)

    // Set custom application menu to show correct app name in menu items
    const appName = 'SlayZone'
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: appName,
        submenu: [
          { role: 'about', label: `About ${appName}` },
          {
            label: 'Settings...',
            accelerator: 'Cmd+,',
            click: () => emitOpenSettings()
          },
          {
            label: 'Project Settings...',
            accelerator: 'Cmd+Shift+,',
            click: () => emitOpenProjectSettings()
          },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide', label: `Hide ${appName}` },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit', label: `Quit ${appName}` }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ]
      }
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  }

  // Register diagnostics first so IPC handlers below are instrumented.
  registerDiagnosticsHandlers(ipcMain, db)

  // Register domain handlers (inject ipcMain and db)
  registerProjectHandlers(ipcMain, db)
  registerTaskHandlers(ipcMain, db)
  registerAiHandlers(ipcMain)
  registerTagHandlers(ipcMain, db)
  registerSettingsHandlers(ipcMain, db)
  registerThemeHandlers(ipcMain, db)
  registerClaudeHandlers(ipcMain)
  registerPtyHandlers(ipcMain, db)

  // Expose test helpers for e2e
  if (isPlaywright) {
    ;(globalThis as Record<string, unknown>).__db = db
    ;(globalThis as Record<string, unknown>).__restorePtyHandlers = () => {
      for (const ch of [
        'pty:create', 'pty:write', 'pty:resize', 'pty:kill', 'pty:exists',
        'pty:getBuffer', 'pty:clearBuffer', 'pty:getBufferSince', 'pty:list', 'pty:getState',
      ]) {
        ipcMain.removeHandler(ch)
      }
      registerPtyHandlers(ipcMain, db)
    }
  }

  registerTerminalTabsHandlers(ipcMain, db)
  registerFilesHandlers(ipcMain)
  registerWorktreeHandlers(ipcMain)
  registerAiConfigHandlers(ipcMain, db)
  registerIntegrationHandlers(ipcMain, db)
  linearSyncPoller = startLinearSyncPoller(db)

  // Configure webview session for WebAuthn/passkey support
  const browserSession = session.fromPartition('persist:browser-tabs')

  browserSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowedPermissions = ['hid', 'usb', 'clipboard-read', 'clipboard-write']
    callback(allowedPermissions.includes(permission) || permission === 'unknown')
  })

  browserSession.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'hid' || details.deviceType === 'usb') {
      return true
    }
    return false
  })

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.slayzone.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Shell: open external URLs
  ipcMain.handle('shell:open-external', (_event, url: string) => {
    shell.openExternal(url)
  })

  // App version
  ipcMain.handle('app:getVersion', () => app.getVersion())

  // Window close
  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.close()
  })

  // Dialog
  ipcMain.handle(
    'dialog:showOpenDialog',
    async (
      _,
      options: {
        title?: string
        defaultPath?: string
        properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>
      }
    ) => {
      return dialog.showOpenDialog(options)
    }
  )

  // Webview shortcut interception
  const registeredWebviews = new Set<number>()

  ipcMain.handle('webview:register-shortcuts', (event, webviewId: number) => {
    if (registeredWebviews.has(webviewId)) return

    const wc = webContents.fromId(webviewId)
    if (!wc) return

    registeredWebviews.add(webviewId)

    wc.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return
      if (!(input.control || input.meta)) return

      // Cmd/Ctrl+1-9 for tab switching, T/A/D for adding items, L for URL bar
      if (/^[1-9tadl]$/i.test(input.key)) {
        e.preventDefault()
        event.sender.send('webview:shortcut', { key: input.key.toLowerCase() })
      }
    })

    wc.on('destroyed', () => registeredWebviews.delete(webviewId))
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up database connection and active processes before quitting
app.on('will-quit', () => {
  if (linearSyncPoller) {
    clearInterval(linearSyncPoller)
    linearSyncPoller = null
  }
  stopDiagnostics()
  stopIdleChecker()
  killAllPtys()
  closeDatabase()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
