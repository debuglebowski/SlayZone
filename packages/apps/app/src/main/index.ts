import { app, shell, BrowserWindow, ipcMain, nativeTheme, session, webContents, dialog, Menu, protocol } from 'electron'
import { join, extname } from 'path'
import { promises as fsp } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// Custom protocol for serving local files in browser panel webviews
// (must be registered before app ready — Chromium blocks file:// in webviews)
protocol.registerSchemesAsPrivileged([
  { scheme: 'slz-file', privileges: { secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } }
])

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
import { registerPtyHandlers, registerClaudeHandlers, registerUsageHandlers, killAllPtys, startIdleChecker, stopIdleChecker } from '@slayzone/terminal/main'
import { registerTerminalTabsHandlers } from '@slayzone/task-terminals/main'
import { registerWorktreeHandlers } from '@slayzone/worktrees/main'
import { registerDiagnosticsHandlers, registerProcessDiagnostics, stopDiagnostics } from '@slayzone/diagnostics/main'
import { registerAiConfigHandlers } from '@slayzone/ai-config/main'
import { registerIntegrationHandlers, startLinearSyncPoller } from '@slayzone/integrations/main'
import { registerFileEditorHandlers } from '@slayzone/file-editor/main'
import { registerScreenshotHandlers } from './screenshot'
import { registerExportImportHandlers } from './export-import'
import { initAutoUpdater } from './auto-updater'

const DEFAULT_WINDOW_WIDTH = 1760
const DEFAULT_WINDOW_HEIGHT = 1280

let mainWindow: BrowserWindow | null = null
let linearSyncPoller: NodeJS.Timeout | null = null
let mcpCleanup: (() => void) | null = null

function emitOpenSettings(): void {
  mainWindow?.webContents.send('app:open-settings')
}

function emitOpenProjectSettings(): void {
  mainWindow?.webContents.send('app:open-project-settings')
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
    if (mainWindow) startIdleChecker(mainWindow)
    // In Playwright mode, keep window hidden to avoid focus stealing during tests
    if (!isPlaywright) mainWindow?.show()
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
      return
    }

    if (input.type === 'keyDown' && input.key.toLowerCase() === 's' && input.meta && input.shift) {
      event.preventDefault()
      mainWindow?.webContents.send('app:screenshot-trigger')
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
  registerUsageHandlers(ipcMain)
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
  registerFileEditorHandlers(ipcMain)
  registerScreenshotHandlers()
  registerExportImportHandlers(ipcMain, db, isPlaywright)

  // Start MCP server (use port 0 in Playwright to avoid conflict with dev instance)
  const mcpPort = (() => {
    if (isPlaywright) return 0
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('mcp_server_port') as { value: string } | undefined
    return parseInt(row?.value || '45678', 10) || 45678
  })()
  import('./mcp-server').then((mod) => {
    mod.startMcpServer(db, mcpPort)
    mcpCleanup = () => mod.stopMcpServer()
  }).catch((err) => {
    console.error('[MCP] Failed to start server:', err)
  })

  linearSyncPoller = startLinearSyncPoller(db)

  initAutoUpdater()

  // Configure webview session for WebAuthn/passkey support
  const browserSession = session.fromPartition('persist:browser-tabs')

  // Serve local files via slz-file:// in browser panel webviews
  // (Chromium blocks file:// navigation in webviews — custom protocol bypasses this)
  browserSession.protocol.handle('slz-file', async (request) => {
    // slz-file:///path/to/file → /path/to/file
    const filePath = decodeURIComponent(request.url.replace(/^slz-file:\/\//, ''))
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css',
      '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
      '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
      '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain',
    }
    try {
      const data = await fsp.readFile(filePath)
      return new Response(data, {
        headers: { 'content-type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream' }
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

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

  // Webview device emulation
  ipcMain.handle(
    'webview:enable-device-emulation',
    (_, webviewId: number, params: {
      screenSize: { width: number; height: number }
      viewSize: { width: number; height: number }
      deviceScaleFactor: number
      screenPosition: 'mobile' | 'desktop'
      userAgent?: string
    }) => {
      const wc = webContents.fromId(webviewId)
      if (!wc) return false
      wc.enableDeviceEmulation({
        screenPosition: params.screenPosition,
        screenSize: params.screenSize,
        viewSize: params.viewSize,
        deviceScaleFactor: params.deviceScaleFactor,
        viewPosition: { x: 0, y: 0 },
        scale: 1,
      })
      if (params.userAgent) {
        wc.setUserAgent(params.userAgent)
      }
      return true
    }
  )

  ipcMain.handle('webview:disable-device-emulation', (_, webviewId: number) => {
    const wc = webContents.fromId(webviewId)
    if (!wc) return false
    wc.disableDeviceEmulation()
    wc.setUserAgent('')
    return true
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else mainWindow?.show()
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
  mcpCleanup?.()
  stopDiagnostics()
  stopIdleChecker()
  killAllPtys()
  closeDatabase()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
