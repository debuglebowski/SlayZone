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

  // Track whether chunks were received
  let chunksReceived = false

  // Handle spawn errors (e.g., command not found)
  activeProcess.on('error', (error) => {
    const errorMessage = error.message.includes('ENOENT')
      ? 'Claude CLI not found. Please ensure Claude CLI is installed and available in your PATH.'
      : `Failed to start Claude CLI: ${error.message}`
    win.webContents.send('claude:error', errorMessage)
    win.webContents.send('claude:done', { code: 1 })
    activeProcess = null
  })

  // Check if stdout is available before creating readline interface
  if (!activeProcess.stdout) {
    win.webContents.send('claude:error', 'Failed to access process output stream')
    win.webContents.send('claude:done', { code: 1 })
    activeProcess = null
    return
  }

  // Parse NDJSON from stdout
  let rl
  try {
    rl = createInterface({ input: activeProcess.stdout })
  } catch (error) {
    const err = error as Error
    win.webContents.send('claude:error', `Failed to create readline interface: ${err.message}`)
    win.webContents.send('claude:done', { code: 1 })
    activeProcess = null
    return
  }

  rl.on('line', (line) => {
    try {
      const data = JSON.parse(line)
      chunksReceived = true
      win.webContents.send('claude:chunk', data)
    } catch {
      // Skip non-JSON lines
    }
  })

  rl.on('error', (error) => {
    win.webContents.send('claude:error', `Failed to read Claude output: ${error.message}`)
    win.webContents.send('claude:done', { code: 1 })
  })

  activeProcess.stderr?.on('data', (data) => {
    win.webContents.send('claude:error', data.toString())
  })

  activeProcess.on('close', (code) => {
    // If process completed successfully but no chunks were received, provide feedback
    if (code === 0 && !chunksReceived) {
      win.webContents.send('claude:error', 'Claude CLI completed but produced no output. This may indicate an issue with the command or configuration.')
    }
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
