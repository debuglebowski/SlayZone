import { spawn, ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import { BrowserWindow } from 'electron'

let activeProcess: ChildProcess | null = null

export function streamClaude(win: BrowserWindow, prompt: string, context?: string): void {
  // Kill existing if any
  if (activeProcess) {
    activeProcess.kill('SIGTERM')
    activeProcess = null
  }

  // Build args
  const args = ['-p', '--verbose', '--output-format', 'stream-json']
  if (context) {
    args.push('--append-system-prompt', context)
  }
  args.push(prompt)

  // Spawn process
  activeProcess = spawn('claude', args, {
    stdio: ['ignore', 'pipe', 'pipe']
  })

  // Parse NDJSON from stdout
  const rl = createInterface({ input: activeProcess.stdout! })

  rl.on('line', (line) => {
    try {
      const data = JSON.parse(line)
      win.webContents.send('claude:chunk', data)
    } catch {
      // Skip non-JSON lines
    }
  })

  activeProcess.stderr?.on('data', (data) => {
    win.webContents.send('claude:error', data.toString())
  })

  activeProcess.on('close', (code) => {
    win.webContents.send('claude:done', { code })
    activeProcess = null
  })
}

export function cancelClaude(): boolean {
  if (activeProcess) {
    activeProcess.kill('SIGTERM')
    activeProcess = null
    return true
  }
  return false
}

export function getActiveProcess(): ChildProcess | null {
  return activeProcess
}
