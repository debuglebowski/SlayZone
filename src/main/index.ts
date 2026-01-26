import { app, shell, BrowserWindow, ipcMain, nativeTheme, session, webContents, dialog, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// #region agent log
fetch('http://127.0.0.1:7246/ingest/99fa6442-9a16-4bdf-bbc1-4c693694c593',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:TOP',message:'App info at startup',data:{appName:app.name,appPath:app.getAppPath(),execPath:process.execPath},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B'})}).catch(()=>{});
// #endregion

// Enable remote debugging for MCP server (dev only)
if (is.dev) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}
import icon from '../../resources/icon.png?asset'
import { getDatabase, closeDatabase } from './db'
import { registerDatabaseHandlers } from './ipc/database'
import { registerClaudeHandlers } from './ipc/claude'
import { registerThemeHandlers } from './ipc/theme'
import { registerPtyHandlers } from './ipc/pty'
import { registerAiHandlers } from './ipc/ai'
import { registerFilesHandlers } from './ipc/files'
import { killAllPtys, startIdleChecker, stopIdleChecker } from './services/pty-manager'

// Minimum splash screen display time (ms)
const SPLASH_MIN_DURATION = 2800

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
      color: #e5e5e5;
    }
    .title {
      margin-top: 24px;
      font-size: 28px;
      font-weight: 600;
      color: #fafafa;
      display: flex;
    }
    .letter {
      opacity: 0;
      animation: fadeIn 0.15s ease-out forwards;
    }
    .line2-container {
      display: inline-flex;
      clip-path: inset(0 100% 0 0);
      animation: reveal 0.5s ease-out 1.75s forwards;
    }
    @keyframes reveal {
      from { clip-path: inset(0 100% 0 0); }
      to { clip-path: inset(0 0 0 0); }
    }
    .letter.line1:nth-child(1) { animation-delay: 0.6s; }
    .letter.line1:nth-child(2) { animation-delay: 0.65s; }
    .letter.line1:nth-child(3) { animation-delay: 0.7s; }
    .letter.line1:nth-child(4) { animation-delay: 0.75s; }
    .letter.line1:nth-child(5) { animation-delay: 0.8s; }
    .letter.line1:nth-child(6) { animation-delay: 0.85s; }
    .letter.line1:nth-child(7) { animation-delay: 0.9s; }
    .letter.line1:nth-child(8) { animation-delay: 0.95s; }
    .letter.line1:nth-child(9) { animation-delay: 1s; }
    .line2-container .letter { opacity: 1; animation: none; }
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
    .fade-out {
      animation: fadeOut 0.3s ease-out forwards;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-wrapper">
      <svg class="logo" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 8 C32 8 22 22 22 36 C22 46 26 54 32 56 C38 54 42 46 42 36 C42 22 32 8 32 8Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M32 24 C32 24 28 32 28 40 C28 44 30 48 32 48 C34 48 36 44 36 40 C36 32 32 24 32 24Z" fill="currentColor" opacity="0.4"/>
      </svg>
    </div>
    <div class="title">
      <span class="letter line1">B</span>
      <span class="letter line1">r</span>
      <span class="letter line1">e</span>
      <span class="letter line1">a</span>
      <span class="letter line1">t</span>
      <span class="letter line1">h</span>
      <span class="letter line1">.</span>
      <span class="letter line1">.</span>
      <span class="letter line1">.</span>
      <span class="line2-container">
        <span class="letter">&nbsp;&nbsp;&nbsp;</span>
        <span class="letter">t</span>
        <span class="letter">h</span>
        <span class="letter">e</span>
        <span class="letter">n</span>
        <span class="letter">&nbsp;</span>
        <span class="letter">s</span>
        <span class="letter">l</span>
        <span class="letter">a</span>
        <span class="letter">y</span>
      </span>
    </div>
    <div class="version">v${version}</div>
  </div>
</body>
</html>
`

let splashWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null
let splashShownAt: number = 0

function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 1911,
    height: 1421,
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
    width: 1911,
    height: 1421,
    show: false,
    center: true,
    title: 'OmgSlayZone',
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
    // Calculate remaining time to keep splash visible
    const elapsed = Date.now() - splashShownAt
    const remaining = Math.max(0, SPLASH_MIN_DURATION - elapsed)

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
      mainWindow?.show()
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
  createSplashWindow()
  createMainWindow()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Initialize database
  const db = getDatabase()

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
    const appName = 'OmgSlayZone'
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: appName,
        submenu: [
          { role: 'about', label: `About ${appName}` },
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

  // Register IPC handlers
  registerDatabaseHandlers()
  registerClaudeHandlers()
  registerThemeHandlers()
  registerPtyHandlers()
  registerAiHandlers()
  registerFilesHandlers()

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
  electronApp.setAppUserModelId('com.electron')

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
  stopIdleChecker()
  killAllPtys()
  closeDatabase()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
