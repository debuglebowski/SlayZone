import { readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, relative } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, '../dist')
const redirectsPath = resolve(dist, '_redirects')

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const out = []
  for (const e of entries) {
    const p = resolve(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p)))
    else if (e.name.endsWith('.html')) out.push(p)
  }
  return out
}

const SKIP = new Set(['/index.html', '/404.html'])

const base = await readFile(redirectsPath, 'utf8')

const explicit = new Set()
for (const line of base.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const [from] = trimmed.split(/\s+/)
  if (from && from.startsWith('/')) explicit.add(from)
}

const htmlRules = []
const slashRules = []
for (const file of (await walk(dist)).sort()) {
  const path = '/' + relative(dist, file).replace(/\\/g, '/')
  if (SKIP.has(path)) continue
  const cleanUrl = path.replace(/\.html$/, '')
  if (!explicit.has(path)) {
    htmlRules.push(`${path} ${cleanUrl} 301`)
  }
  const slashedPath = `${cleanUrl}/`
  if (!explicit.has(slashedPath)) {
    slashRules.push(`${slashedPath} ${cleanUrl} 301`)
  }
}

const out = `${base.trimEnd()}
\n# Auto-generated trailing-slash → clean URL rules (build-redirects.mjs)
${slashRules.join('\n')}

# Auto-generated .html → clean URL rules (build-redirects.mjs)
${htmlRules.join('\n')}
`
await writeFile(redirectsPath, out)
console.log(`[build-redirects] generated ${slashRules.length} slash rules + ${htmlRules.length} .html rules`)
