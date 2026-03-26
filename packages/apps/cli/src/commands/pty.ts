import { Command } from 'commander'
import { apiGet, apiPost, apiDelete, apiFetch } from '../api'

interface PtyInfo {
  sessionId: string
  taskId: string
  mode: string
  state: string
  createdAt: number
  lastOutputTime: number
}

const KITTY_SHIFT_ENTER = '\x1b[13;2u'
const KITTY_MODES = new Set(['claude-code'])

function resolveSession(sessions: PtyInfo[], idPrefix: string): PtyInfo {
  const matches = sessions.filter(s => s.sessionId.startsWith(idPrefix))
  if (matches.length === 0) {
    console.error(`PTY session not found: ${idPrefix}`)
    process.exit(1)
  }
  if (matches.length > 1) {
    console.error(`Ambiguous id prefix "${idPrefix}". Matches: ${matches.map(s => s.sessionId).join(', ')}`)
    process.exit(1)
  }
  return matches[0]
}

function encodedId(sessionId: string): string {
  return encodeURIComponent(sessionId)
}

function formatAge(ms: number): string {
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  return `${hr}h${min % 60}m`
}

export function ptyCommand(): Command {
  const cmd = new Command('pty').description('List and interact with PTY sessions')

  // slay pty list
  cmd
    .command('list')
    .description('List all active PTY sessions')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const sessions = await apiGet<PtyInfo[]>('/api/pty')

      if (opts.json) {
        console.log(JSON.stringify(sessions, null, 2))
        return
      }

      if (sessions.length === 0) {
        console.log('No PTY sessions.')
        return
      }

      const idW = 24
      const taskW = 12
      const modeW = 14
      const stateW = 10
      console.log(`${'SESSION'.padEnd(idW)}  ${'TASK'.padEnd(taskW)}  ${'MODE'.padEnd(modeW)}  ${'STATE'.padEnd(stateW)}  AGE`)
      console.log(`${'-'.repeat(idW)}  ${'-'.repeat(taskW)}  ${'-'.repeat(modeW)}  ${'-'.repeat(stateW)}  ${'-'.repeat(6)}`)
      const now = Date.now()
      for (const s of sessions) {
        const id = s.sessionId.padEnd(idW)
        const task = s.taskId.slice(0, taskW).padEnd(taskW)
        const mode = s.mode.slice(0, modeW).padEnd(modeW)
        const state = s.state.padEnd(stateW)
        const age = formatAge(now - s.createdAt)
        console.log(`${id}  ${task}  ${mode}  ${state}  ${age}`)
      }
    })

  // slay pty buffer <id>
  cmd
    .command('buffer <id>')
    .description('Dump the terminal buffer for a PTY session (id prefix supported)')
    .action(async (idPrefix) => {
      const sessions = await apiGet<PtyInfo[]>('/api/pty')
      const session = resolveSession(sessions, idPrefix)
      const res = await apiFetch(`/api/pty/${encodedId(session.sessionId)}/buffer`)
      if (!res.ok) {
        console.error(`Failed to get buffer: ${res.status}`)
        process.exit(1)
      }
      process.stdout.write(await res.text())
    })

  // slay pty follow <id>
  cmd
    .command('follow <id>')
    .description('Stream PTY output in real time (id prefix supported)')
    .option('--full', 'Replay existing buffer before streaming live output')
    .action(async (idPrefix, opts) => {
      const sessions = await apiGet<PtyInfo[]>('/api/pty')
      const session = resolveSession(sessions, idPrefix)
      const query = opts.full ? '?full=true' : ''
      const res = await apiFetch(`/api/pty/${encodedId(session.sessionId)}/follow${query}`)

      if (!res.ok || !res.body) {
        console.error(`Failed to follow PTY: ${res.status}`)
        process.exit(1)
      }

      const decoder = new TextDecoder()
      for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
        const text = decoder.decode(chunk)
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6)
            try {
              process.stdout.write(JSON.parse(payload) as string)
            } catch {
              process.stdout.write(payload)
            }
          } else if (line.startsWith('event: exit')) {
            process.exit(0)
          }
        }
      }
    })

  // slay pty write <id> <data>
  cmd
    .command('write <id> <data>')
    .description('Send raw data to PTY stdin (id prefix supported)')
    .action(async (idPrefix, data) => {
      const sessions = await apiGet<PtyInfo[]>('/api/pty')
      const session = resolveSession(sessions, idPrefix)
      await apiPost<{ ok: boolean }>(`/api/pty/${encodedId(session.sessionId)}/write`, { data })
    })

  // slay pty submit <id> [text]
  cmd
    .command('submit <id> [text]')
    .description('Submit text to PTY — handles newlines for AI modes (id prefix supported)')
    .action(async (idPrefix, text?: string) => {
      const sessions = await apiGet<PtyInfo[]>('/api/pty')
      const session = resolveSession(sessions, idPrefix)

      // Read from stdin if no text argument
      if (!text) {
        const chunks: Buffer[] = []
        for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
        text = Buffer.concat(chunks).toString('utf-8')
      }

      // For AI modes that support Kitty protocol, encode internal newlines
      let data: string
      if (KITTY_MODES.has(session.mode)) {
        data = text.replace(/\n/g, KITTY_SHIFT_ENTER) + '\n'
      } else {
        data = text + '\n'
      }

      await apiPost<{ ok: boolean }>(`/api/pty/${encodedId(session.sessionId)}/write`, { data })
    })

  // slay pty kill <id>
  cmd
    .command('kill <id>')
    .description('Kill a PTY session (id prefix supported)')
    .action(async (idPrefix) => {
      const sessions = await apiGet<PtyInfo[]>('/api/pty')
      const session = resolveSession(sessions, idPrefix)
      await apiDelete<{ ok: boolean }>(`/api/pty/${encodedId(session.sessionId)}`)
      console.log(`Killed: ${session.sessionId}`)
    })

  return cmd
}
