import { Command } from 'commander'
import { apiGet, apiDelete, apiFetch } from '../api'

interface ProcessInfo {
  id: string
  taskId: string | null
  label: string
  command: string
  status: string
  pid: number | null
  exitCode: number | null
  startedAt: string
}

export function processesCommand(): Command {
  const cmd = new Command('processes')
    .description('List and inspect running processes')
    .showSuggestionAfterError(true)
    .showHelpAfterError(true)

  // slay processes list
  cmd
    .command('list')
    .description('List all processes managed by the running app')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const procs = await apiGet<ProcessInfo[]>('/api/processes')

      if (opts.json) {
        console.log(JSON.stringify(procs, null, 2))
        return
      }

      if (procs.length === 0) {
        console.log('No processes.')
        return
      }

      const idW = 9
      const statusW = 10
      const labelW = 20
      console.log(`${'ID'.padEnd(idW)}  ${'STATUS'.padEnd(statusW)}  ${'LABEL'.padEnd(labelW)}  COMMAND`)
      console.log(`${'-'.repeat(idW)}  ${'-'.repeat(statusW)}  ${'-'.repeat(labelW)}  ${'-'.repeat(30)}`)
      for (const p of procs) {
        const id = p.id.slice(0, 8).padEnd(idW)
        const status = p.status.padEnd(statusW)
        const label = p.label.slice(0, labelW).padEnd(labelW)
        console.log(`${id}  ${status}  ${label}  ${p.command}`)
      }
    })

  // slay processes logs <id>
  cmd
    .command('logs <id>')
    .description('Print log output for a process (id prefix supported)')
    .option('-n, --lines <n>', 'Last N lines', '50')
    .action(async (idPrefix, opts) => {
      const procs = await apiGet<ProcessInfo[]>('/api/processes')
      const matches = procs.filter(p => p.id.startsWith(idPrefix))

      if (matches.length === 0) {
        console.error(`Process not found: ${idPrefix}`)
        process.exit(1)
      }
      if (matches.length > 1) {
        console.error(`Ambiguous id prefix "${idPrefix}". Matches: ${matches.map(p => p.id.slice(0, 8)).join(', ')}`)
        process.exit(1)
      }

      const proc = matches[0]
      const data = await apiGet<{ id: string; label: string; logs: string[] }>(`/api/processes/${proc.id}/logs`)
      const lines = parseInt(opts.lines, 10)
      const output = data.logs.slice(-lines)

      if (output.length === 0) {
        console.log('(no output)')
        return
      }

      console.log(output.join('\n'))
    })

  // slay processes kill <id>
  cmd
    .command('kill <id>')
    .description('Kill a process (id prefix supported)')
    .action(async (idPrefix) => {
      const procs = await apiGet<ProcessInfo[]>('/api/processes')
      const matches = procs.filter((p) => p.id.startsWith(idPrefix))

      if (matches.length === 0) {
        console.error(`Process not found: ${idPrefix}`)
        process.exit(1)
      }
      if (matches.length > 1) {
        console.error(`Ambiguous id prefix "${idPrefix}". Matches: ${matches.map((p) => p.id.slice(0, 8)).join(', ')}`)
        process.exit(1)
      }

      const proc = matches[0]
      await apiDelete<{ ok: boolean }>(`/api/processes/${proc.id}`)
      console.log(`Killed: ${proc.id.slice(0, 8)}  ${proc.label}`)
    })

  // slay processes follow <id>
  cmd
    .command('follow <id>')
    .description('Stream logs for a process in real time (id prefix supported)')
    .action(async (idPrefix) => {
      const procs = await apiGet<ProcessInfo[]>('/api/processes')
      const matches = procs.filter((p) => p.id.startsWith(idPrefix))

      if (matches.length === 0) {
        console.error(`Process not found: ${idPrefix}`)
        process.exit(1)
      }
      if (matches.length > 1) {
        console.error(`Ambiguous id prefix "${idPrefix}". Matches: ${matches.map((p) => p.id.slice(0, 8)).join(', ')}`)
        process.exit(1)
      }

      const proc = matches[0]
      const res = await apiFetch(`/api/processes/${proc.id}/follow`)

      if (!res.ok || !res.body) {
        console.error(`Failed to follow process: ${res.status}`)
        process.exit(1)
      }

      const contentType = res.headers.get('content-type') ?? ''

      if (!contentType.includes('event-stream')) {
        // Finished process — plain text dump
        console.log(await res.text())
        return
      }

      // SSE stream
      const decoder = new TextDecoder()
      for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
        const text = decoder.decode(chunk)
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ')) process.stdout.write(line.slice(6) + '\n')
        }
      }
    })

  return cmd
}
