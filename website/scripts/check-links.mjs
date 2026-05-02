import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, relative, extname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, '../dist')

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

const HREF = /href\s*=\s*"([^"]+)"/g
const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico', '.xml', '.txt', '.json', '.pdf', '.css', '.js', '.mjs', '.woff', '.woff2'])

const violations = []

for (const file of await walk(dist)) {
  const html = await readFile(file, 'utf8')
  const rel = relative(dist, file)
  for (const m of html.matchAll(HREF)) {
    const href = m[1]
    if (!href.startsWith('/')) continue
    if (href.startsWith('//')) continue
    const [path] = href.split(/[?#]/)
    if (!path) continue
    if (SKIP_EXT.has(extname(path).toLowerCase())) continue
    if (path === '/') continue
    if (!path.endsWith('/')) continue
    violations.push({ file: rel, href })
  }
}

if (violations.length) {
  console.error(`[check-links] ${violations.length} internal href(s) with trailing slash:`)
  for (const v of violations) console.error(`  ${v.file}: ${v.href}`)
  process.exit(1)
}

console.log('[check-links] no internal hrefs have trailing slash')
