import { Command } from 'commander'
import { apiGet, apiPost } from '../api'

function resolveTaskId(): string {
  const id = process.env.SLAYZONE_TASK_ID
  if (!id) {
    console.error('$SLAYZONE_TASK_ID is not set. Run this from a task terminal.')
    process.exit(1)
  }
  return id
}

export function browserCommand(): Command {
  const cmd = new Command('browser')
    .description('Control the task browser panel (first tab)')
    .showSuggestionAfterError(true)
    .showHelpAfterError(true)

  cmd.option('--panel <state>', 'Panel visibility: visible or hidden')

  cmd
    .command('url')
    .description('Print current URL')
    .action(async () => {
      const taskId = resolveTaskId()
      const panel = cmd.opts().panel ?? 'hidden'
      const { url } = await apiGet<{ url: string }>(`/api/browser/url?taskId=${taskId}&panel=${panel}`)
      console.log(url)
    })

  cmd
    .command('navigate <url>')
    .description('Navigate browser to URL')
    .action(async (url: string) => {
      const taskId = resolveTaskId()
      const panel = cmd.opts().panel ?? 'visible'
      const result = await apiPost<{ ok: boolean; url: string }>('/api/browser/navigate', { taskId, url, panel })
      console.log(result.url)
    })

  cmd
    .command('click <selector>')
    .description('Click element by CSS selector')
    .action(async (selector: string) => {
      const taskId = resolveTaskId()
      const panel = cmd.opts().panel ?? 'hidden'
      const result = await apiPost<{ ok: boolean; tag?: string; text?: string }>('/api/browser/click', { taskId, selector, panel })
      console.log(`Clicked: <${result.tag}>${result.text ? ` "${result.text}"` : ''}`)
    })

  cmd
    .command('type <selector> <text>')
    .description('Type text into input by CSS selector')
    .action(async (selector: string, text: string) => {
      const taskId = resolveTaskId()
      const panel = cmd.opts().panel ?? 'hidden'
      await apiPost('/api/browser/type', { taskId, selector, text, panel })
      console.log('OK')
    })

  cmd
    .command('eval <code>')
    .description('Execute JavaScript in browser and print result')
    .action(async (code: string) => {
      const taskId = resolveTaskId()
      const panel = cmd.opts().panel ?? 'hidden'
      const { result } = await apiPost<{ ok: boolean; result: unknown }>('/api/browser/eval', { taskId, code, panel })
      console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2))
    })

  cmd
    .command('content')
    .description('Get page text content and interactive elements')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const taskId = resolveTaskId()
      const panel = cmd.opts().panel ?? 'hidden'
      const result = await apiGet<{ url: string; title: string; text: string; interactive: unknown[] }>(
        `/api/browser/content?taskId=${taskId}&panel=${panel}`
      )
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2))
        return
      }
      console.log(`URL:   ${result.url}`)
      console.log(`Title: ${result.title}`)
      console.log()
      console.log(result.text.slice(0, 10000))
      if (result.interactive.length > 0) {
        console.log(`\n--- Interactive elements (${result.interactive.length}) ---`)
        console.log(JSON.stringify(result.interactive, null, 2))
      }
    })

  cmd
    .command('screenshot')
    .description('Capture screenshot to file')
    .option('-o, --output <path>', 'Output file path')
    .action(async (opts) => {
      const taskId = resolveTaskId()
      const panel = cmd.opts().panel ?? 'hidden'
      const { path } = await apiPost<{ ok: boolean; path: string }>('/api/browser/screenshot', { taskId, panel })
      if (opts.output) {
        const { copyFileSync } = await import('fs')
        copyFileSync(path, opts.output)
        console.log(opts.output)
      } else {
        console.log(path)
      }
    })

  return cmd
}
