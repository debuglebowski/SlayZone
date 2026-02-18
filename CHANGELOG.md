# Changelog


## v0.1.47...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.47...main)

### 🚀 Enhancements

- **tasks:** Signal bar priority indicators on kanban cards ([f33bc8c](https://github.com/debuglebowski/omgslayzone/commit/f33bc8c))
- **ui:** Add scroll + thin scrollbar to keyboard shortcuts dialog ([4c64a90](https://github.com/debuglebowski/omgslayzone/commit/4c64a90))
- **task:** Replace in-progress modal with header button ([ce37d16](https://github.com/debuglebowski/omgslayzone/commit/ce37d16))
- **updater:** Show in-app toast when update downloaded ([4b25110](https://github.com/debuglebowski/omgslayzone/commit/4b25110))
- **file-editor:** Render image files in editor panel ([c9d7fcb](https://github.com/debuglebowski/omgslayzone/commit/c9d7fcb))
- **file-editor:** Drag-and-drop files/folders from Finder into editor ([7d9cdac](https://github.com/debuglebowski/omgslayzone/commit/7d9cdac))
- **terminal:** Split terminals into groups with drag-and-drop ([dd53716](https://github.com/debuglebowski/omgslayzone/commit/dd53716))
- **file-editor:** Drag-and-drop to move files/folders within tree ([e0a8279](https://github.com/debuglebowski/omgslayzone/commit/e0a8279))
- **browser:** Multi-device responsive preview + web panel emulation ([4e8068d](https://github.com/debuglebowski/omgslayzone/commit/4e8068d))

### 🩹 Fixes

- **task:** Align title padding and font with kanban header ([ce6fa15](https://github.com/debuglebowski/omgslayzone/commit/ce6fa15))
- **ui:** Add left padding in zen mode to match right/bottom ([08c3fc9](https://github.com/debuglebowski/omgslayzone/commit/08c3fc9))

### 📖 Documentation

- Add known bugs section and star history to README ([750003a](https://github.com/debuglebowski/omgslayzone/commit/750003a))
- Update known bugs list ([656dc14](https://github.com/debuglebowski/omgslayzone/commit/656dc14))
- Trim known bugs list ([59052ae](https://github.com/debuglebowski/omgslayzone/commit/59052ae))

### 🏡 Chore

- Add star history image to assets ([b66bf1e](https://github.com/debuglebowski/omgslayzone/commit/b66bf1e))

### ❤️ Contributors

- Debuglebowski <kh.hansson@gmail.com>

## v0.1.46...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.46...main)

### 🩹 Fixes

- **file-editor:** Show gitignored files grayed out instead of hiding them ([62929e2](https://github.com/debuglebowski/omgslayzone/commit/62929e2))
- **ci:** Inject PostHog secrets into release build ([ed4dfc2](https://github.com/debuglebowski/omgslayzone/commit/ed4dfc2))

### 📖 Documentation

- **website:** Sync features with README, add status tracking ([a3b4a90](https://github.com/debuglebowski/omgslayzone/commit/a3b4a90))

### ❤️ Contributors

- Debuglebowski <kh.hansson@gmail.com>

## v0.1.45...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.45...main)

### 🩹 Fixes

- **terminal:** Catch EBADF on PTY resize when fd is invalid ([9ee1d2f](https://github.com/debuglebowski/omgslayzone/commit/9ee1d2f))

### ❤️ Contributors

- Debuglebowski <kh.hansson@gmail.com>

## v0.1.44...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.44...main)

### 🩹 Fixes

- Auto-updater restart — download before quitAndInstall, add dock progress ([9d0897f](https://github.com/debuglebowski/omgslayzone/commit/9d0897f))

### 💅 Refactors

- Remove checkAvailability + shell-path dependency ([56226fa](https://github.com/debuglebowski/omgslayzone/commit/56226fa))

### ❤️ Contributors

- Debuglebowski <kh.hansson@gmail.com>

## v0.1.43...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.43...main)

### 🩹 Fixes

- CLI detection in prod — use full path + enrich PATH with common bin dirs ([b7440ab](https://github.com/debuglebowski/omgslayzone/commit/b7440ab))

### ❤️ Contributors

- Debuglebowski <kh.hansson@gmail.com>

## v0.1.42...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.42...main)

### 🚀 Enhancements

- Add explode mode — grid view of all open task terminals ([7126a78](https://github.com/debuglebowski/omgslayzone/commit/7126a78))

### 🩹 Fixes

- Move shellPath() into checkAvailability to fix CLI detection without blocking startup ([77da6c5](https://github.com/debuglebowski/omgslayzone/commit/77da6c5))

### ❤️ Contributors

- Debuglebowski <kh.hansson@gmail.com>

## v0.1.40...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.40...main)

### 🩹 Fixes

- Await shellPath() to fix CLI detection in production ([ca522d6](https://github.com/debuglebowski/omgslayzone/commit/ca522d6))
- Auto-updater CJS/ESM interop — use default import ([d5774c7](https://github.com/debuglebowski/omgslayzone/commit/d5774c7))

### 🏡 Chore

- Replace tsc with tsgo for typechecking (22s → 5s) ([fd98337](https://github.com/debuglebowski/omgslayzone/commit/fd98337))

### ❤️ Contributors

- Debuglebowski <kh.hansson@gmail.com>

## v0.1.39...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.39...main)

### 🩹 Fixes

- Change Monosketch shortcut from Cmd+K to Cmd+U ([159cf09](https://github.com/debuglebowski/omgslayzone/commit/159cf09))

### ❤️ Contributors

- Debuglebowski <kh.hansson@gmail.com>

## v0.1.38...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.38...main)

### 🩹 Fixes

- Update Monosketch panel URL to app.monosketch.io ([5a37d14](https://github.com/debuglebowski/omgslayzone/commit/5a37d14))

### ❤️ Contributors

- Debuglebowski <kh.hansson@gmail.com>

## v0.1.37...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.37...main)

### 🩹 Fixes

- **tasks:** Add missing react-hotkeys-hook dependency ([903bccf](https://github.com/debuglebowski/omgslayzone/commit/903bccf))

### ❤️ Contributors

- Debuglebowski <kh.hansson@gmail.com>

## ...main

## v0.1.35...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.35...main)

### 🚀 Enhancements

- Add "Check for Updates" to app menu ([bfa6670](https://github.com/debuglebowski/omgslayzone/commit/bfa6670))

### 🩹 Fixes

- Disable auto-download on startup ([50c9bf2](https://github.com/debuglebowski/omgslayzone/commit/50c9bf2))

### ❤️ Contributors

- Debuglebowski <kh.hansson@gmail.com>

## v0.1.34...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.34...main)

### 🩹 Fixes

- Add favicon to website ([886b767](https://github.com/debuglebowski/omgslayzone/commit/886b767))
- Allow Cmd+R reload in production ([5404504](https://github.com/debuglebowski/omgslayzone/commit/5404504))
- Restore user PATH in production, simplify Claude CLI check ([d9f8443](https://github.com/debuglebowski/omgslayzone/commit/d9f8443))

### 📖 Documentation

- MacOS Gatekeeper note in README ([6040e4a](https://github.com/debuglebowski/omgslayzone/commit/6040e4a))

### ❤️ Contributors

- Debuglebowski <kh.hansson@gmail.com>

## v0.1.31...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.31...main)

### 🩹 Fixes

- GitHub links on website → SlayZone/SlayZone ([2799cfd](https://github.com/debuglebowski/omgslayzone/commit/2799cfd))

### ❤️ Contributors

- Debuglebowski <kh.hansson@gmail.com>
