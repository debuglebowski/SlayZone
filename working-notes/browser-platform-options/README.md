# Browser Platform Options

As of 2026-03-23.

This note summarizes current findings related to:
- Electron `WebContentsView` migration and extension support
- Manifest V3 extension support limits
- Tauri as an alternative host
- Chromium-hosted product tradeoffs vs Electron
- Test strategy for proving production parity during a host migration

## Current SlayZone State

Relevant local implementation and notes:
- [../browser-webcontentsview-migration](../browser-webcontentsview-migration)
- [../../packages/apps/app/src/main/index.ts](../../packages/apps/app/src/main/index.ts)
- [../../packages/apps/app/src/main/browser-view-manager.ts](../../packages/apps/app/src/main/browser-view-manager.ts)
- [../../packages/apps/app/e2e/81-browser-extension-usage.spec.ts](../../packages/apps/app/e2e/81-browser-extension-usage.spec.ts)

Current architecture:
- Browser panel uses `WebContentsView` instead of `<webview>`.
- Extensions are loaded via `session.loadExtension()` on `persist:browser-tabs`.
- `electron-chrome-extensions` is used to provide extension APIs and popup behavior.
- MV2 extension flows work in local tests.
- MV3 is still blocked in practice for the targeted use cases.

## MV3 Extension Findings

### What works today

In the current SlayZone codebase:
- MV2 content scripts work
- MV2 background-page messaging works
- unpacked extensions can be imported and persisted
- `WebContentsView` fixes several embedded-browser issues compared to `<webview>`

### What does not work today

Current limitation observed in SlayZone:
- MV3 extension service workers are not working reliably enough for product use
- target extensions like 1Password / MetaMask remain blocked by that gap

Local evidence:
- `working-notes/browser-webcontentsview-migration` documents MV3 as blocked
- `81-browser-extension-usage.spec.ts` contains an MV3 test marked `@known-limitation`

### Electron status

Electron has moved forward since older reports of MV3 breakage:
- Electron now documents some MV3-related support, including `host_permissions` and `chrome.scripting`
- Electron 35 added service-worker preload support
- Electron exposes `session.serviceWorkers.startWorkerForScope(scope)`

But Electron still explicitly states:
- Chrome extension support is only a subset
- arbitrary Chrome extension compatibility is a non-goal

Practical conclusion:
- Electron is improving, but it is still not a safe foundation if the product requirement is "run mainstream third-party MV3 extensions inside the app with Chrome-like compatibility"

## Alternatives If MV3 Is Required

### 1. Stay on Electron and avoid hard dependency on third-party extensions

Use Electron for:
- embedded browsing
- Google auth fixes
- custom browser UX
- task and AI integration

Avoid requiring browser extensions for core flows:
- prefer passkeys / WebAuthn
- prefer native app or OS integrations where possible
- prefer first-party in-app capabilities over extension dependence

This is the lowest-risk path.

### 2. Stay on Electron and run a focused MV3 spike

Potential spike items:
- upgrade from Electron 39 to current Electron
- retest MV3 behavior on newer Electron
- test service-worker preload support in the browser session
- verify whether failures are due to Electron core, library behavior, or current session/partition setup

This may improve the result, but should still be treated as experimental until proven against real target extensions.

### 3. Offload extension-dependent flows to the user’s real browser

Model:
- SlayZone keeps the task/AI shell
- extension-heavy workflows open in Chrome / Edge / Safari / Firefox
- optionally ship a SlayZone companion browser extension

This is the most pragmatic path if extension correctness matters more than keeping everything inside the app.

### 4. Build on a Chromium-hosted product instead of Electron

This is the strongest path if the product requirement is:
- embedded browser behaves much more like Chrome
- full MV3 extension compatibility becomes a core requirement

This is not a frontend rewrite. React can stay.

The host/runtime changes are the hard part:
- browser process integration
- profile/session management
- extension lifecycle and popup behavior
- permissions, downloads, WebAuthn, autofill, navigation
- native desktop APIs and IPC
- packaging, updater, signing, crash handling

## Tauri Findings

Tauri is not a cross-platform answer for full browser-extension support.

Tauri 2 uses platform webviews:
- Windows: WebView2
- macOS: WKWebView
- Linux: WebKitGTK

Browser-extension support in this ecosystem is platform-specific:
- Windows / WebView2 has browser-extension APIs
- macOS / WKWebView does not provide a Chrome-extension-compatible runtime
- Linux / WebKitGTK is also not a Chrome-extension runtime

Practical conclusion:
- Tauri may help only for a Windows-only extension story
- it is not a path to full cross-platform MV3 support
- for SlayZone, switching to Tauri would also mean giving up Electron’s Node-centric desktop host model

## Can React Stay If SlayZone Moves To Chromium?

Yes.

React is not the issue.

The current app already separates:
- React renderer UI
- Electron/native host logic

A Chromium-hosted product could still use React for:
- sidebar
- task views
- browser chrome owned by SlayZone
- settings
- AI surfaces

The difficult migration is the host layer, not the UI framework.

## Bun / Node Sidecar With A Chromium App

Yes.

A Chromium-hosted app can run a separate `bun` or `node` backend process alongside the browser shell.

The frontend can communicate with that backend over:
- localhost HTTP
- WebSocket
- Unix socket / named pipe
- custom RPC transport

This is a normal architecture for a browser-shell desktop app.

For SlayZone, a sidecar/backend process could own:
- PTY and terminal lifecycle
- SQLite access
- git and filesystem operations
- AI subprocess orchestration
- long-running jobs and background workers

### Security considerations

If the renderer/frontend talks directly to a local backend, the backend must not be treated like an open development server.

Minimum constraints:
- bind only to `127.0.0.1`
- use a random ephemeral port or local socket
- require a per-session auth token
- validate `Origin`
- avoid broad unauthenticated endpoints for filesystem/process access

Even with a direct frontend-to-backend channel, a native host layer is still needed for:
- launching and supervising the backend
- app lifecycle
- windows and menus
- updater
- deep links
- native integrations not owned by the backend alone

### Practical architecture model

- React = UI
- Chromium shell = browser/runtime container
- Bun/Node sidecar = privileged app backend

## Chromium Application vs Electron Application

Assumption: "Chromium application" means a direct Chromium-based shell such as a Chromium fork or a CEF-style host, not Electron.

| Area | Electron app | Chromium app | Result |
|---|---|---|---|
| React frontend | Full support | Full support | Tie |
| MV3 / browser extensions | Partial and intentionally limited | Best path to Chrome-like compatibility | Chromium wins |
| Native desktop APIs | Rich built-ins via Electron APIs | More has to be built or integrated manually | Electron wins |
| Node / child process / PTY / FS | Excellent fit | Requires custom host backend and IPC | Electron wins |
| Browser-level control | Good but limited to Electron APIs | Much deeper if the browser shell is owned directly | Chromium wins |
| Performance potential | Good enough but heavier host stack | Can be leaner, not guaranteed | Slight Chromium edge |
| Startup / memory | Often heavier by default | Can be better tuned, not automatic | Possible Chromium edge |
| Bundle / install size | Large, but mature tooling | Also large; not an automatic win | No clear winner |
| Packaging / distribution | Mature and productive | More bespoke release engineering | Electron wins |
| Security posture | Good defaults exist, needs discipline | Potentially tighter, but more plumbing owned directly | Slight Chromium edge in theory |
| Testing ergonomics | Excellent app-team velocity with Playwright + Electron | Strong native options exist, but more custom harness work | Electron wins for velocity |
| Upgrade / maintenance | Easier app-level maintenance | Heavier browser-runtime maintenance | Electron wins |
| Team/product velocity | Faster for desktop app development | Slower initially unless browser correctness is the main constraint | Electron wins initially |

### What Chromium likely wins

- better chance of real MV3 extension compatibility
- more direct browser/runtime control
- better long-term fit if SlayZone becomes a browser product

### What Electron likely wins

- faster product iteration
- easier terminal / AI / process integration
- better out-of-the-box desktop infrastructure
- simpler packaging and release engineering

### Performance note

Performance is not an automatic Chromium win.

A Chromium-hosted app can outperform Electron, but that depends on implementation quality and workload shape. For SlayZone, performance also depends heavily on:
- terminals / PTYs
- AI subprocesses
- renderer complexity
- SQLite and sync work

Changing hosts alone may not create a dramatic user-visible improvement unless embedded-browser behavior is the dominant bottleneck.

## Performance: Chromium + Sidecar vs Electron

Assumption:
- Electron = Chromium renderer(s) + Electron main process with Node built in
- Chromium + sidecar = Chromium-based shell plus separate `node` or `bun` backend

### Expected performance shape

| Area | Electron | Chromium + Node/Bun sidecar |
|---|---|---|
| Idle RAM | Baseline | Usually similar, sometimes a bit higher because backend is a separate process |
| Startup | Baseline | Can be slightly better or worse depending on shell and sidecar boot sequence |
| Idle CPU | Baseline | Usually similar if the backend is quiet |
| CPU under heavy RPC | Baseline | Can be slightly worse if frontend/backend traffic is very chatty |
| Browser rendering | Similar | Similar, because Chromium is still doing the rendering |
| Backend task performance | Good | Similar with Node; some startup/workload wins possible with Bun |
| Crash isolation | Good | Better for backend logic because the sidecar can crash/restart independently |

### Key conclusion

A Chromium shell plus a `bun`/`node` sidecar is not automatically much lighter than Electron.

Most likely outcomes:
- roughly comparable overall resource usage
- modest improvement in some cases if the shell is lean and the backend is efficient
- modest regression in some cases if the extra process boundary creates overhead

### Why the gain is limited

For an app like SlayZone, major resource costs often come from:
- Chromium renderer processes
- browser tabs/web contents
- PTY/terminal streaming
- AI subprocesses
- SQLite and sync work

That means replacing Electron with a Chromium shell plus a sidecar may not create a dramatic CPU/RAM improvement by itself.

### Bun vs Node

Practical expectation:
- Bun may improve backend startup and some server-side workloads
- Node is more predictable and mature for broad ecosystem compatibility
- neither choice changes the fact that Chromium usually dominates frontend memory cost

### Transport considerations

Direct frontend-to-backend communication is fine for coarse operations:
- DB requests
- git operations
- file access
- AI task creation

It is less ideal if implemented naively for high-frequency streams like:
- PTY output
- terminal resize/state chatter
- fine-grained UI synchronization

If using a sidecar, prefer:
- WebSocket / pipe / socket streaming
- batching and event streams
- fewer coarse RPC boundaries instead of many tiny HTTP calls

### Best current estimate

- Chromium + Bun sidecar could be a little leaner than Electron, or roughly the same
- Chromium + Node sidecar is likely roughly comparable overall
- neither architecture should be expected to produce an order-of-magnitude performance improvement on its own

### Recommended benchmarking approach

If SlayZone evaluates this direction, benchmark a thin prototype using:
- cold start time
- idle RSS/PSS
- one browser tab open
- one terminal streaming
- one AI task running
- tab switching and navigation
- popup/auth flow handling

That will answer the performance question much more reliably than architectural intuition alone.

## Test Strategy And Production Parity

Key conclusion:
- the strongest parity strategy is not "rewrite tests in C++"
- the strongest strategy is "preserve the behavioral test contract"

### What the current suite depends on

The current E2E suite is not just DOM testing.

It depends heavily on Electron-specific capabilities:
- launch via Playwright `_electron`
- privileged evaluation in the host process
- `window.__testInvoke` bridge for direct app IPC
- BrowserWindow inspection
- session inspection
- native browser-view bookkeeping and bounds assertions

This means the current suite is extensive, but not host-neutral.

### Migration-first strategy that makes sense

If SlayZone explores a Chromium-hosted product, the best approach is:

1. Define a host-agnostic test adapter
2. Preserve the existing TypeScript/Playwright suite
3. Replace Electron-only fixture internals with a stable host test RPC layer
4. Implement that layer in the new host
5. Run the same behavior suite against both hosts

### Why this matters

If the migrated suite passes against the new host, that is strong evidence of parity.

But parity only exists for what the suite actually covers. The suite is already valuable because it covers a lot of host-sensitive behavior, especially around:
- browser tabs/views
- popups
- session behavior
- extension loading
- focus and z-order
- terminal and app integration

### Recommended shape of a new host test harness

Keep:
- Playwright
- TypeScript tests
- DOM assertions
- current behavioral spec structure

Replace:
- Electron launch fixture
- Electron-specific `evaluate()` calls
- Electron-only preload bridge assumptions

Add:
- a host test RPC surface for reset/seed
- native window enumeration
- session/profile inspection
- browser-tab introspection
- popup tracking
- extension management hooks
- focus / bounds / visibility queries

### Why not move tests into C++ unless necessary

Native Chromium testing stacks are real and powerful, but they are best suited when the product is actually built on Chromium source and the team wants to test native browser code directly.

For SlayZone, the faster route to proving parity is probably:
- TypeScript + Playwright over CDP
- plus a native host test adapter

That keeps most current test investment usable.

## Bottom-Line Recommendations

### If the goal is fastest product velocity

Stay on Electron.

Use:
- `WebContentsView`
- native/browser hardening already implemented
- no hard dependency on third-party MV3 extensions for core flows

### If the goal is embedded-browser correctness with real extension parity

Electron is a weak long-term foundation for that requirement.

The viable paths are:
- push extension-dependent workflows into the user’s real browser, or
- move toward a Chromium-hosted product

### If SlayZone wants to evaluate a Chromium migration seriously

Do this first:
- build a host-agnostic E2E adapter
- preserve the current suite in TypeScript
- use the suite as the parity gate for any new host

That is the highest-leverage migration path.

### If considering a Chromium + sidecar architecture

This is technically viable and can preserve the current React frontend.

But it does not automatically:
- solve extension parity unless the browser shell itself does
- solve performance unless benchmarks confirm it

What it does improve is separation between:
- UI concerns
- privileged backend concerns
- host lifecycle concerns

### If considering it mainly for performance

Benchmark first.

The likely result is:
- modest gains at best
- broad parity or slightly higher overhead in some scenarios
- no guaranteed dramatic reduction in CPU or RAM

## Sources

Local sources:
- [../browser-webcontentsview-migration](../browser-webcontentsview-migration)
- [../../packages/apps/app/src/main/index.ts](../../packages/apps/app/src/main/index.ts)
- [../../packages/apps/app/src/main/browser-view-manager.ts](../../packages/apps/app/src/main/browser-view-manager.ts)
- [../../packages/apps/app/e2e/81-browser-extension-usage.spec.ts](../../packages/apps/app/e2e/81-browser-extension-usage.spec.ts)
- [../../packages/apps/app/e2e/fixtures/electron.ts](../../packages/apps/app/e2e/fixtures/electron.ts)
- [../../packages/apps/app/e2e/fixtures/browser-view.ts](../../packages/apps/app/e2e/fixtures/browser-view.ts)

External sources:
- Electron Chrome extension support: https://www.electronjs.org/docs/latest/api/extensions
- Electron session API: https://www.electronjs.org/docs/latest/api/session
- Electron service workers API: https://www.electronjs.org/docs/latest/api/service-workers
- Electron process model: https://www.electronjs.org/docs/latest/tutorial/process-model
- Electron sandboxing: https://www.electronjs.org/docs/latest/tutorial/sandbox
- Electron performance guide: https://www.electronjs.org/docs/latest/tutorial/performance
- Electron 35 blog: https://www.electronjs.org/ru/blog
- Chromium browser tests: https://chromium.googlesource.com/website/+/HEAD/site/developers/testing/browser-tests/index.md
- Chromium extension tests: https://chromium.googlesource.com/chromium/src/+/HEAD/extensions/docs/extension_tests.md
- Chromium WebUI testing: https://chromium.googlesource.com/chromium/src/+/main/docs/webui/testing_webui.md
- CEF repository: https://github.com/chromiumembedded/cef
- CEF extension management issue: https://github.com/chromiumembedded/cef/issues/3450
- CEF installation size issue: https://github.com/chromiumembedded/cef/issues/3836
- Tauri process model: https://v2.tauri.app/concept/process-model/
- Tauri `WebviewBuilder` docs: https://docs.rs/tauri/latest/tauri/webview/struct.WebviewBuilder.html
- WebView2 environment options: https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/winrt/microsoft_web_webview2_core/corewebview2environmentoptions
- Safari Web Extensions overview: https://developer.apple.com/safari/extensions/
- Playwright CDP connection: https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp
- Chromium memory usage backgrounder: https://www.chromium.org/developers/memory-usage-backgrounder/
- Chromium IPC design docs: https://www.chromium.org/developers/design-documents/inter-process-communication
- Bun runtime docs: https://bun.sh/docs/runtime
