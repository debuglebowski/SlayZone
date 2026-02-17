#!/usr/bin/env bash
set -euo pipefail

VERSION=$(node -p "require('./packages/apps/app/package.json').version")

echo "Releasing v$VERSION..."

changelogen --output CHANGELOG.md
git add packages/apps/app/package.json CHANGELOG.md
git commit -m "release: v$VERSION"
git tag "v$VERSION"
git push
git push --tags

echo "Released v$VERSION"
