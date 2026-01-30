# Desktop App

Electron desktop application - single app combining main process, renderer, and preload.

## Structure

```
src/
├── main/           # Electron main process (Node.js)
├── renderer/       # React frontend (browser)
├── preload/        # IPC bridge
└── shared/         # Cross-process types
```

## Entry Points

| Process | Entry | Purpose |
|---------|-------|---------|
| Main | `main/index.ts` | Window creation, IPC handlers, app lifecycle |
| Renderer | `renderer/src/main.tsx` | React app mount |
| Preload | `preload/index.ts` | Context bridge for IPC |

## Build

```bash
npm run dev          # Dev server with HMR
npm run build        # Production build
npm run build:mac    # macOS .app
npm run build:win    # Windows installer
npm run build:linux  # Linux package
```

Uses electron-vite for bundling.

## Window Configuration

- `titleBarStyle: 'hiddenInset'` - macOS traffic lights
- `trafficLightPosition: { x: 16, y: 16 }`
- `backgroundColor: '#0a0a0a'` - Dark background
- Splash screen with animated logo (2.8s minimum)

## IPC Security

- `sandbox: true` - Renderer sandboxed
- `contextIsolation: true` - No direct Node access
- `nodeIntegration: false`
- All APIs exposed via contextBridge

## Domains

See [ARCHITECTURE.md](./ARCHITECTURE.md) for domain breakdown.

| Domain | Main Process | Renderer |
|--------|--------------|----------|
| tasks | - | Kanban, filters |
| task | CRUD handlers, AI | Detail page, dialogs |
| projects | CRUD handlers | Dialogs, sidebar |
| tags | CRUD handlers | Inline in other UIs |
| terminal | PTY manager, adapters | Terminal component |
| settings | KV store, theme | Settings dialog |
| onboarding | - | Tutorial dialog |

## Key Dependencies

### Main
- `better-sqlite3` - SQLite database
- `node-pty` - Terminal emulation
- `electron` - Desktop framework

### Renderer
- `react` - UI framework
- `@xterm/xterm` - Terminal rendering
- `@radix-ui/*` - UI primitives
- `tailwindcss` - Styling
- `framer-motion` - Animations
- `@dnd-kit/*` - Drag and drop

## Keyboard Shortcuts

Registered in App.tsx via react-hotkeys-hook, except `Cmd+§` which is intercepted at Electron level.

## Sessions

- WebAuthn/passkey support via `session.fromPartition('persist:browser-tabs')`
- HID/USB permissions for hardware keys
