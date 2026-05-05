import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  FALLBACK_ACCOUNT_DEFAULT_MODEL,
  normalizeAccountModel,
  type ResolvedChatModel,
} from '../shared/chat-model'

/**
 * Resolve what `claude` will pick when no `--model` flag is passed.
 * Reads `~/.claude/settings.json` `model` field. Falls back to opus when
 * the file is missing, unparseable, has no `model` key, or names a model
 * we don't recognize.
 *
 * Caches result for the lifetime of the process — settings.json only
 * changes via `claude config` or manual edits, so a restart picks up
 * changes. Mirrors `auto-mode-eligibility.ts` precedent.
 */
let cached: ResolvedChatModel | null = null

export async function resolveAccountDefaultModel(): Promise<ResolvedChatModel> {
  if (cached) return cached
  cached = await read()
  return cached
}

/** Test-only: drop the in-process cache. */
export function _resetAccountDefaultModelCache(): void {
  cached = null
}

async function read(): Promise<ResolvedChatModel> {
  const home = os.homedir()
  const raw = await safeRead(path.join(home, '.claude', 'settings.json'))
  const settings = parseJson(raw)
  const model = pickString(settings, ['model'])
  if (model == null) return FALLBACK_ACCOUNT_DEFAULT_MODEL
  return normalizeAccountModel(model)
}

async function safeRead(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf-8')
  } catch {
    return null
  }
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function pickString(obj: unknown, keyPath: string[]): string | null {
  let cur: unknown = obj
  for (const k of keyPath) {
    if (cur == null || typeof cur !== 'object') return null
    cur = (cur as Record<string, unknown>)[k]
  }
  return typeof cur === 'string' ? cur : null
}
