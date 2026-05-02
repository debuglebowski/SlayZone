import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, '../dist')
const base = process.env.SEO_CHECK_BASE ?? 'https://slay.zone'

const entries = await readdir(dist).catch(() => [])
const sitemapFile = entries.find((n) => /^sitemap-\d+\.xml$/.test(n)) ?? 'sitemap-0.xml'
const xml = await readFile(resolve(dist, sitemapFile), 'utf8')
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

if (!urls.length) {
  console.error(`[check-urls] no <loc> entries in ${sitemapFile}`)
  process.exit(1)
}

const targets = urls.map((u) => u.replace(/^https:\/\/slay\.zone/, base))
const failures = []

for (const url of targets) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual' })
    if (res.status !== 200) failures.push({ url, status: res.status, location: res.headers.get('location') ?? '' })
  } catch (e) {
    failures.push({ url, status: 'ERR', location: String(e) })
  }
}

if (failures.length) {
  console.error(`[check-urls] ${failures.length}/${targets.length} URL(s) not 200:`)
  for (const f of failures) console.error(`  ${f.status} ${f.url}${f.location ? ` → ${f.location}` : ''}`)
  process.exit(1)
}

console.log(`[check-urls] all ${targets.length} sitemap URLs return 200`)
