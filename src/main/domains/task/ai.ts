import { ipcMain } from 'electron'
import { spawn } from 'child_process'
import { homedir, platform } from 'os'
import type { TerminalMode } from '../../../shared/types/database'

export function registerAiHandlers(): void {
  ipcMain.handle(
    'ai:generate-description',
    async (_, title: string, mode: TerminalMode): Promise<{ success: boolean; description?: string; error?: string }> => {
      if (mode === 'terminal') {
        return { success: false, error: 'AI not available in terminal mode' }
      }

      const prompt = `Generate a concise task description (2-3 sentences) for: "${title}". Focus on what needs to be done, not how. Output only the description.`

      try {
        const result = await runAiCommand(mode, prompt)
        return { success: true, description: result }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )
}

async function runAiCommand(mode: TerminalMode, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const claudePath = platform() === 'win32' ? 'claude' : `${homedir()}/.local/bin/claude`

    const cmd = mode === 'claude-code' ? claudePath : 'codex'
    const args = mode === 'claude-code' ? ['--print', '--dangerously-skip-permissions', prompt] : [prompt]

    console.log('[ai] Running:', cmd, args)

    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    let error = ''

    proc.stdout?.on('data', (d) => {
      output += d.toString()
      console.log('[ai] stdout:', d.toString())
    })
    proc.stderr?.on('data', (d) => {
      error += d.toString()
      console.log('[ai] stderr:', d.toString())
    })

    proc.on('close', (code) => {
      console.log('[ai] Exit code:', code)
      if (code === 0) resolve(output.trim())
      else reject(new Error(error || `Exit code ${code}`))
    })

    proc.on('error', (err) => {
      console.log('[ai] Error:', err)
      reject(err)
    })

    // Timeout after 30s
    const timeout = setTimeout(() => {
      proc.kill()
      reject(new Error('Timeout'))
    }, 30000)

    proc.on('close', () => clearTimeout(timeout))
  })
}
