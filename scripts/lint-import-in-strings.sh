#!/usr/bin/env bash
# Guard: no whitespace-prefixed lowercase `import` inside string literals.
#
# electron-vite's esmShimPlugin uses a regex `(?<=\s|^|;)import\s*[...]?["']` to
# locate the last ESM import statement in a rendered chunk so it can inject
# CJS shims (`__filename`, `__dirname`, `require`) at the right position. The
# regex doesn't tokenize JS — it matches the word `import` inside string
# literals too. Triggers an injection mid-string, corrupting the main-process
# bundle. patches/electron-vite@5.0.0.patch tightens the lookbehind to `\n`,
# which makes real imports still match (always at line start) but excludes the
# space-import pattern. This script is belt-and-suspenders in case the patch
# ever drifts on upgrade.
#
# Pattern: any source string with a space/tab before lowercase "import",
# followed by whitespace or quote. Skip the patch file itself + bundler files
# under node_modules (already excluded by the rg path).

set -euo pipefail

# Match string literals (single or double quoted) where `import` appears as a
# word (preceded by whitespace, followed by whitespace or quote). These trip
# the bundler regex. Only single-line strings; multi-line template literals
# are extremely unlikely to contain the trigger pattern in practice.
#
# Word-boundary at end ([\t \'"]) skips false positives like "imported",
# "imports", "importing" that don't actually trigger the bundler regex.
PATTERN_SQ="'[^']*[ 	]import[\t '\"][^']*'"
PATTERN_DQ="\"[^\"]*[ 	]import[\t '\"][^\"]*\""

# Only scan code that gets bundled into the main process (where the CJS shim
# plugin runs). Renderer + e2e are unaffected.
MAIN_BUNDLED_PATHS=(
  packages/apps/app/src/main/
  packages/apps/app/src/preload/
  packages/shared/transport/src/server/
  packages/shared/platform/src/
  packages/domains/*/src/server/
  packages/domains/*/src/electron/
)

# shellcheck disable=SC2068  # intentional word splitting for path globs
MATCHES=$(grep -rnE --include="*.ts" --include="*.tsx" "$PATTERN_SQ|$PATTERN_DQ" ${MAIN_BUNDLED_PATHS[@]} 2>/dev/null || true)

if [ -n "$MATCHES" ]; then
  echo "Found ' import ' (whitespace-prefixed lowercase) inside source files."
  echo ""
  echo "This pattern trips electron-vite's CJS-shim injection regex and breaks"
  echo "the main-process bundle. Use a hyphen ('dry-run-import') or a different"
  echo "keyword. Background: see patches/electron-vite@5.0.0.patch."
  echo ""
  echo "$MATCHES"
  exit 1
fi

echo "Import-in-strings lint passed — no triggering patterns found."
