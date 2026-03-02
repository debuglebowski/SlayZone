import type { IpcMain } from 'electron'
import { net } from 'electron'
import { spawn } from 'child_process'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { ProviderUsage, UsageWindow } from '@slayzone/terminal/shared'
import { fetchGlmUsage } from './adapters/glm-usage'

const TIMEOUT_MS = 10_000

// ── Provider metadata ────────────────────────────────────────────────

interface ProviderMeta { id: string; label: string; cli: string; vendor: string }
const CLAUDE: ProviderMeta = { id: 'claude', label: 'Claude', cli: 'claude', vendor: 'Anthropic' }
const CODEX: ProviderMeta = { id: 'codex', label: 'Codex', cli: 'codex', vendor: 'OpenAI' }
const GLM: ProviderMeta = { id: 'glm', label: 'GLM (Z.AI)', cli: 'glm', vendor: 'Z.AI' }

// ── Error helpers ────────────────────────────────────────────────────

function usageError(p: ProviderMeta, error: string): ProviderUsage {
  return { provider: p.id, label: p.label, fiveHour: null, sevenDay: null, sevenDayOpus: null, sevenDaySonnet: null, error, fetchedAt: Date.now() }
}

function httpError(status: number, p: ProviderMeta): string {
  if (status === 401) return `Token expired — re-authenticate with \`${p.cli}\``
  if (status === 403) return `Access denied — check your ${p.label} plan`
  if (status === 429) return 'Too many requests — try again later'
  if (status >= 500) return `${p.vendor} API error (${status})`
  return `HTTP ${status}`
}

function friendlyError(e: unknown): string {
  if (!(e instanceof Error)) return 'Unknown error'
  const msg = e.message
  if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('ERR_NETWORK'))
    return 'Network error — check your connection'
  if (msg.includes('ETIMEDOUT') || msg.includes('UND_ERR_CONNECT_TIMEOUT'))
    return 'Request timed out'
  if (msg.includes('CERT') || msg.includes('SSL'))
    return 'SSL error — VPN or proxy may be interfering'
  return msg
}

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
  const token = await getKeychainToken()
  if (!token) return usageError(CLAUDE, `Not logged in — run \`${CLAUDE.cli}\` to authenticate`)

  const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'anthropic-beta': 'oauth-2025-04-20',
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) return usageError(CLAUDE, httpError(res.status, CLAUDE))

  const data = await res.json()
  return {
    provider: CLAUDE.id,
    label: CLAUDE.label,
    fiveHour: mapWindow(data.five_hour),
    sevenDay: mapWindow(data.seven_day),
    sevenDayOpus: mapWindow(data.seven_day_opus),
    sevenDaySonnet: mapWindow(data.seven_day_sonnet),
    error: null,
    fetchedAt: Date.now()
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
  const auth = await getCodexAuth()
  if (!auth) return usageError(CODEX, `Not logged in — run \`${CODEX.cli}\` to authenticate`)

  // Electron's net module uses Chromium's HTTP stack (HTTP/2) which bypasses Cloudflare JA3 fingerprint checks
  const res = await net.fetch('https://chatgpt.com/backend-api/wham/usage', {
    headers: {
      'Authorization': `Bearer ${auth.accessToken}`,
      'ChatGPT-Account-Id': auth.accountId,
      'User-Agent': 'codex-cli',
      'Accept': 'application/json'
    }
  })

  if (!res.ok) return usageError(CODEX, httpError(res.status, CODEX))

  const data = await res.json()
  const rl = data.rate_limit
  return {
    provider: CODEX.id,
    label: CODEX.label,
    fiveHour: mapCodexWindow(rl?.primary_window),
    sevenDay: mapCodexWindow(rl?.secondary_window),
    sevenDayOpus: null,
    sevenDaySonnet: null,
    error: null,
    fetchedAt: Date.now()
  }
}

// ── Handler ──────────────────────────────────────────────────────────

export function registerUsageHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('usage:fetch', async (): Promise<ProviderUsage[]> => {
    const fetchers = [
      fetchClaudeUsage().catch((e): ProviderUsage => usageError(CLAUDE, friendlyError(e))),
      fetchCodexUsage().catch((e): ProviderUsage => usageError(CODEX, friendlyError(e))),
      fetchGlmUsage().catch((e): ProviderUsage => usageError(GLM, friendlyError(e)))
    ]
    return Promise.all(fetchers)
  })
}
