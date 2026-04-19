#!/usr/bin/env bash
# Guard against hardcoded color classes that bypass the theme system.
# Tutorial scenes and project-settings color palette are intentional, excluded.

set -euo pipefail

PALETTE='(bg|text|border|hover:bg|hover:text|dark:bg|dark:text|dark:border|dark:hover:bg|dark:hover:text|focus:border|focus:bg)-(neutral|zinc|slate|stone|gray)-[0-9]+'
HEX='(bg|text|border|fill|stroke|dark:bg|dark:text|dark:border)-\[#[0-9a-fA-F]+\]'
FORBIDDEN="($PALETTE)|($HEX)"
EXCLUDE_REGEX='/tutorial/(scenes/|TutorialAnimationModal\.tsx)|project-settings-shared\.tsx'

MATCHES=$(grep -rnE --include="*.tsx" "$FORBIDDEN" packages/ 2>/dev/null | grep -vE "$EXCLUDE_REGEX" || true)

if [ -n "$MATCHES" ]; then
  echo "Hardcoded color classes bypass the theme system. Use theme tokens instead (bg-surface-*, bg-accent, bg-muted, text-foreground, text-muted-foreground, border-border, etc)."
  echo ""
  echo "$MATCHES"
  exit 1
fi

echo "Theme lint passed — no hardcoded color classes found."
