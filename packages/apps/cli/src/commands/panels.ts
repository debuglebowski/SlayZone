import { Command } from 'commander'
import { openDb, notifyApp } from '../db'
import type { PanelConfig, WebPanelDefinition } from '@slayzone/task/shared/types'
import { DEFAULT_PANEL_CONFIG, isPanelEnabled } from '@slayzone/task/shared/types'
import { mergePredefinedWebPanels, validatePanelShortcut } from '@slayzone/task/shared/panel-config'
import { normalizeDesktopProtocol, inferProtocolFromUrl, inferHostScopeFromUrl } from '@slayzone/task/shared/handoff'
import type { SlayDb } from '../db'

function loadPanelConfig(db: SlayDb): PanelConfig {
  const row = db.query<{ value: string }>(`SELECT value FROM settings WHERE key = 'panel_config' LIMIT 1`)
  if (!row[0]?.value) return { ...DEFAULT_PANEL_CONFIG }
  try {
    return mergePredefinedWebPanels(JSON.parse(row[0].value) as PanelConfig)
  } catch {
    return { ...DEFAULT_PANEL_CONFIG }
  }
}

function savePanelConfig(db: SlayDb, config: PanelConfig): void {
  db.run(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (:key, :value)`,
    { ':key': 'panel_config', ':value': JSON.stringify(config) }
  )
}

function findPanel(config: PanelConfig, idOrName: string): WebPanelDefinition | undefined {
  return config.webPanels.find(p =>
    p.id === idOrName || p.name.toLowerCase() === idOrName.toLowerCase()
  )
}

export function panelsCommand(): Command {
  const cmd = new Command('panels')
    .description('Manage web panels')
    .showSuggestionAfterError(true)
    .showHelpAfterError(true)

  // slay panels list
  cmd
    .command('list')
    .description('List web panels')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const db = openDb()
      const config = loadPanelConfig(db)
      db.close()

      if (opts.json) {
        console.log(JSON.stringify(config.webPanels, null, 2))
        return
      }

      if (config.webPanels.length === 0) {
        console.log('No web panels configured.')
        return
      }

      const idW = 12
      const nameW = 20
      const urlW = 35
      console.log(`${'ID'.padEnd(idW)}  ${'NAME'.padEnd(nameW)}  ${'URL'.padEnd(urlW)}  ${'KEY'.padEnd(4)}  ON`)
      console.log(`${'-'.repeat(idW)}  ${'-'.repeat(nameW)}  ${'-'.repeat(urlW)}  ${'-'.repeat(4)}  ${'-'.repeat(2)}`)
      for (const wp of config.webPanels) {
        const id = wp.id.slice(0, 12).padEnd(idW)
        const name = wp.name.slice(0, nameW).padEnd(nameW)
        const url = wp.baseUrl.slice(0, urlW).padEnd(urlW)
        const shortcut = (wp.shortcut ? wp.shortcut.toUpperCase() : '').padEnd(4)
        const enabled = isPanelEnabled(config, wp.id, 'task') ? '✓' : '✗'
        console.log(`${id}  ${name}  ${url}  ${shortcut}  ${enabled}`)
      }
    })

  // slay panels create
  cmd
    .command('create <name> <url>')
    .description('Create a custom web panel')
    .option('-s, --shortcut <letter>', 'Keyboard shortcut (single letter)')
    .option('--block-handoff', 'Block desktop app handoff')
    .option('--protocol <protocol>', 'Handoff protocol (requires --block-handoff)')
    .action(async (name: string, rawUrl: string, opts) => {
      if (!name.trim()) {
        console.error('Panel name is required.')
        process.exit(1)
      }

      if (opts.protocol && !opts.blockHandoff) {
        console.error('--protocol requires --block-handoff')
        process.exit(1)
      }

      let url = rawUrl.trim()
      if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`

      const db = openDb()
      const config = loadPanelConfig(db)

      // Validate shortcut
      if (opts.shortcut) {
        const err = validatePanelShortcut(opts.shortcut, config.webPanels)
        if (err) {
          db.close()
          console.error(err)
          process.exit(1)
        }
      }

      // Resolve handoff
      let handoffProtocol: string | undefined
      let handoffHostScope: string | undefined
      if (opts.blockHandoff) {
        const resolved = normalizeDesktopProtocol(opts.protocol) ?? inferProtocolFromUrl(url)
        if (!resolved) {
          db.close()
          console.error('Could not determine handoff protocol. Use --protocol to specify.')
          process.exit(1)
        }
        handoffProtocol = resolved
        handoffHostScope = inferHostScopeFromUrl(url) ?? undefined
      }

      const newPanel: WebPanelDefinition = {
        id: `web:${crypto.randomUUID().slice(0, 8)}`,
        name: name.trim(),
        baseUrl: url,
        shortcut: opts.shortcut?.trim().toLowerCase() || undefined,
        blockDesktopHandoff: opts.blockHandoff || undefined,
        handoffProtocol,
        handoffHostScope,
      }

      savePanelConfig(db, { ...config, webPanels: [...config.webPanels, newPanel] })
      db.close()
      await notifyApp()
      console.log(`Created panel: ${newPanel.id}  ${newPanel.name}  ${newPanel.baseUrl}`)
    })

  // slay panels delete
  cmd
    .command('delete <id-or-name>')
    .description('Delete a web panel')
    .action(async (idOrName: string) => {
      const db = openDb()
      const config = loadPanelConfig(db)
      const wp = findPanel(config, idOrName)
      if (!wp) {
        db.close()
        console.error(`Panel not found: ${idOrName}`)
        process.exit(1)
      }

      const next: PanelConfig = { ...config, webPanels: config.webPanels.filter(p => p.id !== wp.id) }
      if (wp.predefined) next.deletedPredefined = [...(config.deletedPredefined ?? []), wp.id]

      savePanelConfig(db, next)
      db.close()
      await notifyApp()
      console.log(`Deleted panel: ${wp.id}  ${wp.name}`)
    })

  // slay panels enable
  cmd
    .command('enable <id-or-name>')
    .description('Enable a web panel in task view')
    .action(async (idOrName: string) => {
      const db = openDb()
      const config = loadPanelConfig(db)
      const wp = findPanel(config, idOrName)
      if (!wp) {
        db.close()
        console.error(`Panel not found: ${idOrName}`)
        process.exit(1)
      }

      savePanelConfig(db, {
        ...config,
        viewEnabled: { ...config.viewEnabled, task: { ...config.viewEnabled?.task, [wp.id]: true } },
      })
      db.close()
      await notifyApp()
      console.log(`Enabled panel: ${wp.id}  ${wp.name}`)
    })

  // slay panels disable
  cmd
    .command('disable <id-or-name>')
    .description('Disable a web panel in task view')
    .action(async (idOrName: string) => {
      const db = openDb()
      const config = loadPanelConfig(db)
      const wp = findPanel(config, idOrName)
      if (!wp) {
        db.close()
        console.error(`Panel not found: ${idOrName}`)
        process.exit(1)
      }

      savePanelConfig(db, {
        ...config,
        viewEnabled: { ...config.viewEnabled, task: { ...config.viewEnabled?.task, [wp.id]: false } },
      })
      db.close()
      await notifyApp()
      console.log(`Disabled panel: ${wp.id}  ${wp.name}`)
    })

  return cmd
}
