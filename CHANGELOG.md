# Changelog


## v0.1.48...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.48...main)

### 🩹 Fixes

- Actually strip emails from changelog (--hide-author-email flag is broken) ([222ded2](https://github.com/debuglebowski/SlayZone/commit/222ded2))
- **terminal:** Cmd+Shift+K only clears focused terminal ([4fe37bd](https://github.com/debuglebowski/SlayZone/commit/4fe37bd))
- Use --hideAuthorEmail flag in changelogen ([9e4a5eb](https://github.com/debuglebowski/SlayZone/commit/9e4a5eb))
- Abort release if no changes since last tag ([aee4df4](https://github.com/debuglebowski/SlayZone/commit/aee4df4))

### 📖 Documentation

- Test commit ([fdd5f89](https://github.com/debuglebowski/SlayZone/commit/fdd5f89))

### 🏡 Chore

- Remove create-todos command ([2f096c6](https://github.com/debuglebowski/SlayZone/commit/2f096c6))
- Hide author email in changelog ([58c7edf](https://github.com/debuglebowski/SlayZone/commit/58c7edf))
- Hide author email in changelog ([fefd737](https://github.com/debuglebowski/SlayZone/commit/fefd737))
- Strip email from changelog ([2c20cfa](https://github.com/debuglebowski/SlayZone/commit/2c20cfa))
- Clean up duplicate changelog sections ([bb7c1e6](https://github.com/debuglebowski/SlayZone/commit/bb7c1e6))

### ❤️ Contributors

- Debuglebowski




## v0.1.47...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.47...main)

### 🚀 Enhancements

- **tasks:** Signal bar priority indicators on kanban cards ([f33bc8c](https://github.com/debuglebowski/SlayZone/commit/f33bc8c))
- **ui:** Add scroll + thin scrollbar to keyboard shortcuts dialog ([4c64a90](https://github.com/debuglebowski/SlayZone/commit/4c64a90))
- **task:** Replace in-progress modal with header button ([ce37d16](https://github.com/debuglebowski/SlayZone/commit/ce37d16))
- **updater:** Show in-app toast when update downloaded ([4b25110](https://github.com/debuglebowski/SlayZone/commit/4b25110))
- **file-editor:** Render image files in editor panel ([c9d7fcb](https://github.com/debuglebowski/SlayZone/commit/c9d7fcb))
- **file-editor:** Drag-and-drop files/folders from Finder into editor ([7d9cdac](https://github.com/debuglebowski/SlayZone/commit/7d9cdac))
- **terminal:** Split terminals into groups with drag-and-drop ([dd53716](https://github.com/debuglebowski/SlayZone/commit/dd53716))
- **file-editor:** Drag-and-drop to move files/folders within tree ([e0a8279](https://github.com/debuglebowski/SlayZone/commit/e0a8279))
- **browser:** Multi-device responsive preview + web panel emulation ([4e8068d](https://github.com/debuglebowski/SlayZone/commit/4e8068d))

### 🩹 Fixes

- **task:** Align title padding and font with kanban header ([ce6fa15](https://github.com/debuglebowski/SlayZone/commit/ce6fa15))
- **ui:** Add left padding in zen mode to match right/bottom ([08c3fc9](https://github.com/debuglebowski/SlayZone/commit/08c3fc9))

### 📖 Documentation

- Add known bugs section and star history to README ([750003a](https://github.com/debuglebowski/SlayZone/commit/750003a))
- Update known bugs list ([656dc14](https://github.com/debuglebowski/SlayZone/commit/656dc14))
- Trim known bugs list ([59052ae](https://github.com/debuglebowski/SlayZone/commit/59052ae))

### 🏡 Chore

- Add star history image to assets ([b66bf1e](https://github.com/debuglebowski/SlayZone/commit/b66bf1e))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.46...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.46...main)

### 🩹 Fixes

- **file-editor:** Show gitignored files grayed out instead of hiding them ([62929e2](https://github.com/debuglebowski/SlayZone/commit/62929e2))
- **ci:** Inject PostHog secrets into release build ([ed4dfc2](https://github.com/debuglebowski/SlayZone/commit/ed4dfc2))

### 📖 Documentation

- **website:** Sync features with README, add status tracking ([a3b4a90](https://github.com/debuglebowski/SlayZone/commit/a3b4a90))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.45...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.45...main)

### 🩹 Fixes

- **terminal:** Catch EBADF on PTY resize when fd is invalid ([9ee1d2f](https://github.com/debuglebowski/SlayZone/commit/9ee1d2f))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.44...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.44...main)

### 🩹 Fixes

- Auto-updater restart — download before quitAndInstall, add dock progress ([9d0897f](https://github.com/debuglebowski/SlayZone/commit/9d0897f))

### 💅 Refactors

- Remove checkAvailability + shell-path dependency ([56226fa](https://github.com/debuglebowski/SlayZone/commit/56226fa))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.43...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.43...main)

### 🩹 Fixes

- CLI detection in prod — use full path + enrich PATH with common bin dirs ([b7440ab](https://github.com/debuglebowski/SlayZone/commit/b7440ab))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.42...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.42...main)

### 🚀 Enhancements

- Add explode mode — grid view of all open task terminals ([7126a78](https://github.com/debuglebowski/SlayZone/commit/7126a78))

### 🩹 Fixes

- Move shellPath() into checkAvailability to fix CLI detection without blocking startup ([77da6c5](https://github.com/debuglebowski/SlayZone/commit/77da6c5))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.40...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.40...main)

### 🩹 Fixes

- Await shellPath() to fix CLI detection in production ([ca522d6](https://github.com/debuglebowski/SlayZone/commit/ca522d6))
- Auto-updater CJS/ESM interop — use default import ([d5774c7](https://github.com/debuglebowski/SlayZone/commit/d5774c7))

### 🏡 Chore

- Replace tsc with tsgo for typechecking (22s → 5s) ([fd98337](https://github.com/debuglebowski/SlayZone/commit/fd98337))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.39...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.39...main)

### 🩹 Fixes

- Change Monosketch shortcut from Cmd+K to Cmd+U ([159cf09](https://github.com/debuglebowski/SlayZone/commit/159cf09))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.38...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.38...main)

### 🩹 Fixes

- Update Monosketch panel URL to app.monosketch.io ([5a37d14](https://github.com/debuglebowski/SlayZone/commit/5a37d14))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.37...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.37...main)

### 🩹 Fixes

- **tasks:** Add missing react-hotkeys-hook dependency ([903bccf](https://github.com/debuglebowski/SlayZone/commit/903bccf))

### ❤️ Contributors

- Debuglebowski <>

## ...main

## v0.1.35...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.35...main)

### 🚀 Enhancements

- Add "Check for Updates" to app menu ([bfa6670](https://github.com/debuglebowski/SlayZone/commit/bfa6670))

### 🩹 Fixes

- Disable auto-download on startup ([50c9bf2](https://github.com/debuglebowski/SlayZone/commit/50c9bf2))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.34...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.34...main)

### 🩹 Fixes

- Add favicon to website ([886b767](https://github.com/debuglebowski/SlayZone/commit/886b767))
- Allow Cmd+R reload in production ([5404504](https://github.com/debuglebowski/SlayZone/commit/5404504))
- Restore user PATH in production, simplify Claude CLI check ([d9f8443](https://github.com/debuglebowski/SlayZone/commit/d9f8443))

### 📖 Documentation

- MacOS Gatekeeper note in README ([6040e4a](https://github.com/debuglebowski/SlayZone/commit/6040e4a))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.31...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.31...main)

### 🩹 Fixes

- GitHub links on website → SlayZone/SlayZone ([2799cfd](https://github.com/debuglebowski/SlayZone/commit/2799cfd))

### ❤️ Contributors

- Debuglebowski <>
