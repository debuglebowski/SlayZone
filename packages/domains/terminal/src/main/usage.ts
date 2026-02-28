import type { IpcMain } from 'electron'
import { net } from 'electron'
import { spawn } from 'child_process'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { ProviderUsage, UsageWindow } from '@slayzone/terminal/shared'
import { fetchGlmUsage } from './adapters/glm-usage'

const TIMEOUT_MS = 10_000

// ── Claude (Anthropic OAuth API) ─────────────────────────────────────

function getKeychainToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn('security', [
      'find-generic-password',
      '-s', 'Claude Code-credentials',
      '-w'
    ])

    let out = ''
    proc.stdout?.on('data', (d) => { out += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0 || !out.trim()) return resolve(null)
      try {
        const parsed = JSON.parse(out.trim())
        resolve(parsed?.claudeAiOauth?.accessToken ?? null)
      } catch {
        resolve(null)
      }
    })
    proc.on('error', () => resolve(null))

    setTimeout(() => { proc.kill(); resolve(null) }, TIMEOUT_MS)
  })
}

function mapWindow(w: { utilization: number; resets_at: string } | null): UsageWindow | null {
  if (!w) return null
  return { utilization: w.utilization, resetsAt: w.resets_at }
}

async function fetchClaudeUsage(): Promise<ProviderUsage> {
  const now = Date.now()
  const token = await getKeychainToken()
  if (!token) {
    return { provider: 'claude', label: 'Claude', fiveHour: null, sevenDay: null, sevenDayOpus: null, sevenDaySonnet: null, error: 'No OAuth token', fetchedAt: now }
  }

  const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'anthropic-beta': 'oauth-2025-04-20',
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    return { provider: 'claude', label: 'Claude', fiveHour: null, sevenDay: null, sevenDayOpus: null, sevenDaySonnet: null, error: `HTTP ${res.status}`, fetchedAt: now }
  }

  const data = await res.json()
  return {
    provider: 'claude',
    label: 'Claude',
    fiveHour: mapWindow(data.five_hour),
    sevenDay: mapWindow(data.seven_day),
    sevenDayOpus: mapWindow(data.seven_day_opus),
    sevenDaySonnet: mapWindow(data.seven_day_sonnet),
    error: null,
    fetchedAt: now
  }
}

// ── Codex (ChatGPT backend API) ──────────────────────────────────────

interface CodexAuth {
  accessToken: string
  accountId: string
}

async function getCodexAuth(): Promise<CodexAuth | null> {
  try {
    const raw = await readFile(join(homedir(), '.codex', 'auth.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    const tokens = parsed?.tokens
    if (!tokens?.access_token || !tokens?.account_id) return null
    return { accessToken: tokens.access_token, accountId: tokens.account_id }
  } catch {
    return null
  }
}

function mapCodexWindow(w: { used_percent: number; reset_at: number } | null): UsageWindow | null {
  if (!w) return null
  return { utilization: w.used_percent, resetsAt: new Date(w.reset_at * 1000).toISOString() }
}

async function fetchCodexUsage(): Promise<ProviderUsage> {
  const now = Date.now()
  const auth = await getCodexAuth()
  if (!auth) {
    return { provider: 'codex', label: 'Codex', fiveHour: null, sevenDay: null, sevenDayOpus: null, sevenDaySonnet: null, error: 'No auth token', fetchedAt: now }
  }

  // Electron's net module uses Chromium's HTTP stack (HTTP/2) which bypasses Cloudflare JA3 fingerprint checks
  const res = await net.fetch('https://chatgpt.com/backend-api/wham/usage', {
    headers: {
      'Authorization': `Bearer ${auth.accessToken}`,
      'ChatGPT-Account-Id': auth.accountId,
      'User-Agent': 'codex-cli',
      'Accept': 'application/json'
    }
  })

  if (!res.ok) {
    return { provider: 'codex', label: 'Codex', fiveHour: null, sevenDay: null, sevenDayOpus: null, sevenDaySonnet: null, error: `HTTP ${res.status}`, fetchedAt: now }
  }

  const data = await res.json()
  const rl = data.rate_limit
  return {
    provider: 'codex',
    label: 'Codex',
    fiveHour: mapCodexWindow(rl?.primary_window),
    sevenDay: mapCodexWindow(rl?.secondary_window),
    sevenDayOpus: null,
    sevenDaySonnet: null,
    error: null,
    fetchedAt: now
  }
}

// ── Handler ──────────────────────────────────────────────────────────

export function registerUsageHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('usage:fetch', async (): Promise<ProviderUsage[]> => {
    const fetchers = [
      fetchClaudeUsage().catch((e): ProviderUsage => ({
        provider: 'claude', label: 'Claude', fiveHour: null, sevenDay: null, sevenDayOpus: null, sevenDaySonnet: null,
        error: e instanceof Error ? e.message : 'Unknown error', fetchedAt: Date.now()
      })),
      fetchCodexUsage().catch((e): ProviderUsage => ({
        provider: 'codex', label: 'Codex', fiveHour: null, sevenDay: null, sevenDayOpus: null, sevenDaySonnet: null,
        error: e instanceof Error ? e.message : 'Unknown error', fetchedAt: Date.now()
      })),
      fetchGlmUsage().catch((e): ProviderUsage => ({
        provider: 'glm', label: 'GLM (Z.AI)', fiveHour: null, sevenDay: null, sevenDayOpus: null, sevenDaySonnet: null,
        error: e instanceof Error ? e.message : 'Unknown error', fetchedAt: Date.now()
      }))
    ]
    return Promise.all(fetchers)
  })
}
