import { app, shell, BrowserWindow, ipcMain, nativeTheme, session, webContents } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// Enable remote debugging for MCP server (dev only)
if (is.dev) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}
import icon from '../../resources/icon.png?asset'
import { getDatabase, closeDatabase } from './db'
import { registerDatabaseHandlers } from './ipc/database'
import { registerClaudeHandlers } from './ipc/claude'
import { registerThemeHandlers } from './ipc/theme'
import { getActiveProcess } from './services/claude-spawner'

// Minimum splash screen display time (ms)
const SPLASH_MIN_DURATION = 1500

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
    .letter:nth-child(1) { animation-delay: 0.1s; }
    .letter:nth-child(2) { animation-delay: 0.2s; }
    .letter:nth-child(3) { animation-delay: 0.3s; }
    .letter:nth-child(4) { animation-delay: 0.4s; }
    .letter:nth-child(5) { animation-delay: 0.5s; }
    .letter:nth-child(6) { animation-delay: 0.6s; }
    .letter:nth-child(7) { animation-delay: 0.7s; }
    .letter:nth-child(8) { animation-delay: 0.8s; }
    .letter:nth-child(9) { animation-delay: 0.9s; }
    .version {
      position: absolute;
      bottom: 24px;
      font-size: 12px;
      color: #525252;
      opacity: 0;
      animation: fadeIn 0.3s ease-out 1s forwards;
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
        <circle cx="32" cy="32" r="20" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
        <circle cx="32" cy="32" r="12" stroke="currentColor" stroke-width="2" fill="none" opacity="0.5"/>
        <circle cx="32" cy="32" r="4" fill="currentColor"/>
        <path d="M 32 12 L 28 20 M 32 12 L 36 20" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
        <path d="M 52 32 L 44 28 M 52 32 L 44 36" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
        <path d="M 32 52 L 28 44 M 32 52 L 36 44" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
        <path d="M 12 32 L 20 28 M 12 32 L 20 36" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
      </svg>
    </div>
    <div class="title">
      <span class="letter">B</span>
      <span class="letter">r</span>
      <span class="letter">e</span>
      <span class="letter">a</span>
      <span class="letter">t</span>
      <span class="letter">h</span>
      <span class="letter">.</span>
      <span class="letter">.</span>
      <span class="letter">.</span>
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

  // Register IPC handlers
  registerDatabaseHandlers()
  registerClaudeHandlers()
  registerThemeHandlers()

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
  const proc = getActiveProcess()
  if (proc) proc.kill('SIGTERM')
  closeDatabase()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
