#!/usr/bin/env node

// Generates a Homebrew cask formula from a release manifest.
// Usage: generate-homebrew-cask.mjs --manifest <path> --output <path>

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i]
    if (!current.startsWith('--')) continue
    const key = current.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }
    args[key] = value
    i += 1
  }
  return args
}

function findArtifact(artifacts, pattern) {
  return artifacts.find((a) => pattern.test(a.name))
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const manifestPath = args.manifest
  const outputPath = args.output

  if (!manifestPath || !outputPath) {
    throw new Error('Usage: generate-homebrew-cask.mjs --manifest <path> --output <path>')
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const { tag, version } = manifest.release
  const { artifacts } = manifest

  const arm64Dmg = findArtifact(artifacts, /^SlayZone-arm64\.dmg$/)
  const x64Dmg = findArtifact(artifacts, /^SlayZone-x64\.dmg$/)

  if (!arm64Dmg) {
    throw new Error('Missing arm64 DMG artifact in release manifest')
  }
  if (!x64Dmg) {
    throw new Error('Missing x64 DMG artifact in release manifest')
  }

  const baseUrl = `https://github.com/debuglebowski/slayzone/releases/download/${tag}`

  const cask = `cask "slayzone" do
  version "${version}"

  on_arm do
    sha256 "${arm64Dmg.sha256}"
    url "${baseUrl}/${arm64Dmg.name}"
  end

  on_intel do
    sha256 "${x64Dmg.sha256}"
    url "${baseUrl}/${x64Dmg.name}"
  end

  name "SlayZone"
  desc "Desktop task management with integrated AI coding assistants"
  homepage "https://github.com/debuglebowski/slayzone"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "SlayZone.app"

  zap trash: [
    "~/Library/Application Support/SlayZone",
    "~/Library/Preferences/com.slayzone.app.plist",
    "~/Library/Caches/com.slayzone.app",
    "~/Library/Logs/SlayZone",
  ]
end
`

  mkdirSync(path.dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, cask)
  console.log(`Cask formula written to ${outputPath}`)
}

main()
