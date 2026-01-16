# Domain Pitfalls: Electron + React + SQLite Desktop Apps

**Project:** Focus (task management app)
**Researched:** 2026-01-17
**Confidence:** HIGH (verified with official docs and multiple sources)

---

## Critical Pitfalls

Mistakes causing rewrites or major security issues.

### 1. Security: nodeIntegration + contextIsolation Misconfiguration

**What goes wrong:** Enabling `nodeIntegration: true` or disabling `contextIsolation: false` allows XSS vulnerabilities to escalate to Remote Code Execution (RCE). Attacker can run arbitrary system commands.

**Why it happens:**
- Legacy tutorials show insecure patterns
- Easier development without preload scripts
- Copy-pasting old boilerplate code

**Consequences:**
- Any XSS becomes full system compromise
- Security audit failure
- App rejection from enterprise customers

**Warning signs:**
- BrowserWindow without explicit `contextIsolation: true`
- Direct `require('electron')` in renderer
- No preload script in architecture

**Prevention:**
```javascript
// ALWAYS use this secure baseline
new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,      // NEVER enable
    contextIsolation: true,      // ALWAYS enable (default since Electron 12)
    sandbox: true,               // ALWAYS enable
    webSecurity: true,           // ALWAYS enable
    allowRunningInsecureContent: false
  }
});
```

**Phase:** Foundation (Phase 1). Must be correct from first BrowserWindow creation.

**Sources:** [Electron Security Docs](https://www.electronjs.org/docs/latest/tutorial/security), [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)

---

### 2. Security: Webview Without Proper Sandboxing

**What goes wrong:** Your Work Mode uses embedded webviews. Misconfigured webviews become attack vectors - loaded sites can access Node.js APIs and execute system commands.

**Why it happens:**
- `<webview>` tags can be created by malicious scripts in DOM
- Developers enable nodeIntegration for "convenience"
- Missing `will-attach-webview` validation

**Consequences:**
- Arbitrary code execution from loaded websites
- Data exfiltration
- System compromise via malicious URLs

**Warning signs:**
- Webview without explicit `nodeIntegration: false`
- No `will-attach-webview` event handler
- `allowpopups` enabled on webview

**Prevention:**
```javascript
// In main process - validate all webview creation
app.on('web-contents-created', (event, contents) => {
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    // Strip dangerous options
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;

    // Validate URL
    if (!params.src.startsWith('https://')) {
      event.preventDefault();
    }
  });
});
```

Consider using `BrowserView` or `WebContentsView` instead of `<webview>` tag for better security control.

**Phase:** Work Mode implementation. Critical before loading any external URLs.

**Sources:** [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security), [Breach to Barrier](https://www.electronjs.org/blog/breach-to-barrier)

---

### 3. Native Module: better-sqlite3 NODE_MODULE_VERSION Mismatch

**What goes wrong:** App crashes on launch with "The module was compiled against a different Node.js version using NODE_MODULE_VERSION X". Native modules compiled for system Node.js don't work with Electron's Node.js.

**Why it happens:**
- Electron bundles specific Node.js version
- Native modules compile against system Node.js
- Version mismatch at runtime

**Consequences:**
- App won't start on user machines
- Different behavior dev vs production
- Hours of debugging opaque errors

**Warning signs:**
- better-sqlite3 works in dev, crashes in production
- Error mentions NODE_MODULE_VERSION
- Different Node versions between local and CI

**Prevention:**
```json
// package.json
{
  "scripts": {
    "postinstall": "electron-rebuild -f -w better-sqlite3",
    "rebuild": "electron-rebuild -f -w better-sqlite3"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.x"
  }
}
```

Run `npm run rebuild` after every `npm install`. Add to CI pipeline.

**Phase:** Foundation (Phase 1). Set up rebuild script before writing any SQLite code.

**Sources:** [electron-react-boilerplate SQLite issue](https://github.com/electron-react-boilerplate/electron-react-boilerplate/issues/2928), [better-sqlite3 issues](https://github.com/WiseLibs/better-sqlite3/issues/1321)

---

### 4. Database: Wrong SQLite Path in Packaged App

**What goes wrong:** SQLite works in development, fails in production with "SQLITE_CANTOPEN: unable to open database file". App can't persist any data.

**Why it happens:**
- Using `__dirname` or `process.cwd()` which point to different locations in packaged apps
- Database path relative to source, not to user data directory
- ASAR archive contains app code but database writes fail

**Consequences:**
- Complete data loss
- App unusable after packaging
- Shipped broken build to users

**Warning signs:**
- Database works in `npm start`, fails in packaged app
- Using `path.join(__dirname, 'database.sqlite')`
- No `app.getPath('userData')` in codebase

**Prevention:**
```javascript
import { app } from 'electron';
import path from 'path';

const getDatabasePath = () => {
  const userDataPath = app.getPath('userData');
  const dbName = app.isPackaged ? 'focus.sqlite' : 'focus.dev.sqlite';
  return path.join(userDataPath, dbName);
};

// Results in:
// macOS: ~/Library/Application Support/Focus/focus.sqlite
// Windows: C:\Users\<user>\AppData\Local\Focus\focus.sqlite
// Linux: ~/.config/Focus/focus.sqlite
```

**Phase:** Foundation (Phase 1). Establish correct path pattern before any database operations.

**Sources:** [electron-react-boilerplate SQLite](https://github.com/electron-react-boilerplate/electron-react-boilerplate/issues/1820), [Cameron Nokes guide](https://cameronnokes.com/blog/how-to-store-user-data-in-electron/)

---

### 5. Child Process: Claude CLI Spawning Security

**What goes wrong:** Spawning Claude CLI from Node exposes attack vector. Malicious input could inject shell commands. IPC messages from renderer could trigger unauthorized commands.

**Why it happens:**
- Direct child_process.spawn without input validation
- IPC handlers blindly execute renderer requests
- No sandboxing of spawned processes

**Consequences:**
- Remote code execution via crafted prompts
- System compromise if user prompt contains shell metacharacters
- Security audit failure

**Warning signs:**
- `child_process.spawn` with user-provided arguments
- No validation of IPC messages requesting CLI execution
- Shell: true in spawn options

**Prevention:**
```javascript
// In main process ONLY - never expose to renderer directly
import { spawn } from 'child_process';

const spawnClaude = (prompt: string) => {
  // Validate and sanitize
  if (typeof prompt !== 'string' || prompt.length > 100000) {
    throw new Error('Invalid prompt');
  }

  // Use array args, never shell interpolation
  return spawn('claude', ['--prompt', prompt], {
    shell: false,  // CRITICAL: never use shell: true
    env: { ...process.env },  // Explicit env
  });
};

// IPC handler with validation
ipcMain.handle('ai:chat', async (event, prompt) => {
  // Validate sender
  if (event.senderFrame.url !== 'file://...') {
    throw new Error('Unauthorized sender');
  }
  return spawnClaude(prompt);
});
```

Consider using Electron's `utilityProcess` instead of `child_process` for better isolation.

**Phase:** AI Chat integration. Research Claude CLI spawning patterns before implementation.

**Sources:** [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security), [Elastic detection rules](https://www.elastic.co/guide/en/security/current/execution-via-electron-child-process-node-js-module.html)

---

## Moderate Pitfalls

Mistakes causing delays or technical debt.

### 6. Memory Leaks: IPC Listeners Not Removed

**What goes wrong:** Memory grows continuously. After hours of use, app becomes slow and eventually crashes. Common in long-running desktop apps.

**Why it happens:**
- Adding `ipcRenderer.on()` listeners without cleanup
- React components mount/unmount but listeners persist
- Closures capturing large objects

**Warning signs:**
- Memory grows over time in Task Manager
- App slows down after extended use
- Multiple handlers firing for single event

**Prevention:**
```javascript
// In React component with preload bridge
useEffect(() => {
  const handler = (event, data) => { /* ... */ };
  window.electronAPI.onUpdate(handler);

  return () => {
    window.electronAPI.removeUpdateListener(handler);  // CRITICAL
  };
}, []);

// In preload.js - expose removal method
contextBridge.exposeInMainWorld('electronAPI', {
  onUpdate: (callback) => ipcRenderer.on('update', callback),
  removeUpdateListener: (callback) => ipcRenderer.removeListener('update', callback)
});
```

**Phase:** All phases. Pattern must be established early and followed consistently.

**Sources:** [Memory Leaks in Electron](https://www.vb-net.com/AngularElectron/MemoryLeaks.htm), [Debugging Electron Memory](https://seenaburns.com/debugging-electron-memory-usage/)

---

### 7. IPC: Synchronous Calls Blocking UI

**What goes wrong:** UI freezes during database operations or file access. Entire app becomes unresponsive. User thinks app crashed.

**Why it happens:**
- Using `ipcRenderer.sendSync()`
- Using `@electron/remote` module
- Synchronous database calls in main process triggered by renderer

**Warning signs:**
- UI freezes during operations
- `sendSync` in codebase
- `@electron/remote` dependency

**Prevention:**
```javascript
// BAD - blocks UI
const data = ipcRenderer.sendSync('get-data');

// GOOD - async, non-blocking
const data = await ipcRenderer.invoke('get-data');
```

Always use `ipcRenderer.invoke()` + `ipcMain.handle()` pattern. Never `sendSync`.

**Phase:** Foundation (Phase 1). Establish async IPC patterns from start.

**Sources:** [Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance), [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)

---

### 8. Bundling: CommonJS vs ES Modules Conflict

**What goes wrong:** Build fails with cryptic errors about `require` not defined or `import` syntax errors. Different parts of app expect different module systems.

**Why it happens:**
- Electron main process uses CommonJS
- Vite/React uses ES Modules
- Native modules expect CommonJS
- Mixed module systems in dependencies

**Warning signs:**
- "require is not defined" errors
- "Cannot use import statement outside a module"
- Different behavior between dev and production builds

**Prevention:**
- Use electron-vite or electron-forge with proper configuration
- Configure webpack target: `electron-main` for main, `electron-preload` for preload
- Keep main process in CommonJS, compile renderer to ES modules
- Mark native modules as externals

```javascript
// vite.config.ts for main process
export default {
  build: {
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs']  // CommonJS for Electron main
    },
    rollupOptions: {
      external: ['electron', 'better-sqlite3']  // Don't bundle these
    }
  }
};
```

**Phase:** Foundation (Phase 1). Bundler setup must handle this correctly.

**Sources:** [electron-vite troubleshooting](https://electron-vite.org/guide/troubleshooting), [Martin Rocek blog](https://www.rocek.dev/blog/react_vite_a_electron)

---

### 9. React Router: BrowserRouter Doesn't Work

**What goes wrong:** Navigation works in development, breaks in production. Routes return blank pages or errors. Deep links don't work.

**Why it happens:**
- Electron loads files via `file://` protocol
- BrowserRouter expects HTTP server managing history
- No server to handle route requests in packaged app

**Prevention:**
```javascript
// BAD - won't work in packaged Electron
import { BrowserRouter } from 'react-router-dom';

// GOOD - hash-based routing works with file:// protocol
import { HashRouter } from 'react-router-dom';
// OR
import { createHashRouter } from 'react-router-dom';
```

**Phase:** Foundation (Phase 1). Use HashRouter from start.

**Sources:** [Common Electron+React issues](https://gist.github.com/Arkellys/96359e7ba19e98260856c897bc378606)

---

### 10. Distribution: Code Signing and Notarization

**What goes wrong:** Users can't open the app. macOS shows "app is damaged" or "unidentified developer" warnings. Windows SmartScreen blocks installation.

**Why it happens:**
- Missing code signing certificate
- Missing Apple notarization
- Notarization times out or fails silently
- Entitlements misconfigured

**Warning signs:**
- App works on dev machine, fails on fresh install
- Gatekeeper warnings on macOS
- SmartScreen warnings on Windows

**Prevention:**
- **macOS:** Developer ID Application certificate + notarization required
- **Windows:** Consider Azure Trusted Signing (cheaper than EV certs)
- Use Electron Forge or electron-builder with proper signing config

```javascript
// forge.config.ts
module.exports = {
  packagerConfig: {
    osxSign: {
      identity: 'Developer ID Application: Your Name (TEAMID)',
      hardenedRuntime: true,
      entitlements: 'entitlements.plist',
      'entitlements-inherit': 'entitlements.plist'
    },
    osxNotarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    }
  }
};
```

Entitlements for Claude CLI spawning:
```xml
<!-- entitlements.plist -->
<key>com.apple.security.cs.allow-jit</key>
<true/>
<key>com.apple.security.cs.allow-unsigned-executable-memory</key>
<true/>
```

**Phase:** Distribution (later phase). But plan for certificates early - Apple requires paid developer account.

**Sources:** [Electron Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing), [Simon Willison TIL](https://til.simonwillison.net/electron/sign-notarize-electron-macos)

---

## Minor Pitfalls

Annoyances that are fixable but waste time.

### 11. Drag Events: Missing dragover Listener

**What goes wrong:** Drag-drop functionality silently fails. No errors, just doesn't work. Kanban drag-drop feels broken.

**Why it happens:** Electron requires both `drop` and `dragover` event listeners on document.

**Prevention:**
```javascript
// Required for Electron drag-drop to work
document.body.addEventListener('dragover', (e) => {
  e.preventDefault();
});
document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  // Handle drop
});
```

**Phase:** Kanban implementation.

---

### 12. Virtualization + Drag-Drop Conflicts

**What goes wrong:** With many tasks, virtualized lists conflict with drag-drop libraries. Dragged items disappear mid-drag, drop zones don't register.

**Why it happens:**
- Virtualization removes DOM elements when scrolled out of view
- Drag-drop libraries lose reference to removed elements
- Event listeners detach when element unmounts

**Prevention:**
- Use `@atlaskit/pragmatic-drag-and-drop` which handles virtualization
- Or use `react-virtualized-dnd` designed for this case
- Keep dragged item in DOM during drag operation

**Phase:** Kanban implementation, if task lists grow large.

**Sources:** [Pragmatic DnD virtualization](https://atlassian.design/components/pragmatic-drag-and-drop/core-package/improving-performance/virtualization/)

---

### 13. Streaming: UI Freezes During AI Response

**What goes wrong:** While streaming Claude responses, UI becomes unresponsive. Can't interact with other parts of app during AI generation.

**Why it happens:**
- Synchronous IPC flooding main thread
- Large response chunks blocking render
- No chunking/throttling of updates

**Prevention:**
```javascript
// Main process - stream chunks efficiently
childProcess.stdout.on('data', (chunk) => {
  // Batch small chunks, don't send every byte
  buffer += chunk;
  if (buffer.length > 100 || Date.now() - lastSend > 50) {
    mainWindow.webContents.send('ai:chunk', buffer);
    buffer = '';
    lastSend = Date.now();
  }
});

// Renderer - use React transitions
import { startTransition } from 'react';

window.electronAPI.onAIChunk((chunk) => {
  startTransition(() => {
    setResponse(prev => prev + chunk);
  });
});
```

**Phase:** AI Chat implementation.

**Sources:** [Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance), [Web Workers for UI gains](https://medium.com/@devoopsie/how-i-squeezed-out-80-ui-speed-gains-using-web-workers-in-my-electron-app-9fe4e7731e7d)

---

### 14. macOS Tahoe: Electron System Lag (2025 Bug)

**What goes wrong:** On macOS Tahoe (2025), having multiple Electron apps open causes system-wide window lag and stuttering.

**Why it happens:** Electron overrides private AppKit API (`_cornerMask`) for vibrant views, breaking WindowServer shadow memoization.

**Warning signs:**
- System lag with Discord + VS Code + your app open
- Window shadows constantly repainting

**Prevention:**
- Keep Electron updated - fix may be in newer versions
- Reduce vibrant/translucent UI elements
- Test on macOS Tahoe during development

**Phase:** All phases. Monitor for Electron updates addressing this.

**Sources:** [Michael Tsai blog](https://mjtsai.com/blog/2025/09/30/electron-apps-causing-system-wide-lag-on-tahoe/)

---

## Phase-Specific Warning Matrix

| Phase | Critical Pitfall | Check Before Starting |
|-------|-----------------|----------------------|
| Foundation | Security baseline, SQLite paths, IPC patterns | #1, #3, #4, #6, #7, #8, #9 |
| Kanban | Drag-drop events, virtualization | #11, #12 |
| Work Mode | Webview security | #2 |
| AI Chat | CLI spawning security, streaming | #5, #13 |
| Distribution | Code signing, notarization | #10 |

---

## Verification Checklist

Before each phase, verify:

- [ ] BrowserWindow has secure `webPreferences` baseline
- [ ] All IPC uses async `invoke`/`handle` pattern
- [ ] IPC listeners have cleanup in useEffect returns
- [ ] Database path uses `app.getPath('userData')`
- [ ] Native modules rebuilt with `electron-rebuild`
- [ ] HashRouter (not BrowserRouter) for routing
- [ ] No `@electron/remote` or `sendSync` usage
- [ ] Webviews validate URLs in `will-attach-webview`
- [ ] Child processes use `shell: false`

---

## Sources Summary

**Official Documentation:**
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)

**Community Resources:**
- [Avoiding Pitfalls (NCC Group)](https://www.nccgroup.com/research-blog/avoiding-pitfalls-developing-with-electron/)
- [Electron App Security Risks](https://blog.securelayer7.net/electron-app-security-risks/)
- [Building High-Performance Electron Apps](https://www.johnnyle.io/read/electron-performance)
- [Debugging Electron Memory](https://seenaburns.com/debugging-electron-memory-usage/)
