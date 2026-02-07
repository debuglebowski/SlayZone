#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script only applies to macOS."
  exit 1
fi

echo "Resetting macOS icon caches..."

# IconServices cache (per-user)
rm -f "$HOME/Library/Caches/com.apple.iconservices.store" || true
rm -rf "$HOME/Library/Caches/com.apple.iconservices" || true

# Dock icon cache (per-user)
rm -f "$HOME/Library/Application Support/Dock/iconcache" || true
rm -f "$HOME/Library/Application Support/Dock/*.db" || true

echo "Restarting Dock to reload icons..."
killall Dock || true

echo "Done. You may need to relaunch the app to see updated icons."
