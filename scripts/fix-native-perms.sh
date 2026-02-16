#!/bin/bash
# Fix execute permissions on native binaries that pnpm may strip during install
chmod +x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper 2>/dev/null
chmod +x node_modules/node-pty/prebuilds/darwin-x64/spawn-helper 2>/dev/null
