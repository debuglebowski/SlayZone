const base = process.env.REDIRECT_TEST_BASE ?? process.argv[2] ?? 'https://slay.zone'

const cases = [
  // Clean URLs → 200
  { url: '/', expect: 200 },
  { url: '/pricing', expect: 200 },
  { url: '/features', expect: 200 },
  { url: '/features/board', expect: 200 },
  { url: '/comparison', expect: 200 },
  { url: '/comparison/superset', expect: 200 },
  { url: '/docs', expect: 200 },
  { url: '/faq', expect: 200 },
  { url: '/llms.txt', expect: 200 },
  { url: '/sitemap-index.xml', expect: 200 },
  { url: '/sitemap-0.xml', expect: 200 },
  { url: '/robots.txt', expect: 200 },

  // Trailing slash → 301 → clean
  { url: '/pricing/', expect: 301, location: '/pricing' },
  { url: '/features/', expect: 301, location: '/features' },
  { url: '/features/board/', expect: 301, location: '/features/board' },
  { url: '/comparison/', expect: 301, location: '/comparison' },
  { url: '/comparison/superset/', expect: 301, location: '/comparison/superset' },

  // .html → 301 → clean
  { url: '/pricing.html', expect: 301, location: '/pricing' },
  { url: '/features.html', expect: 301, location: '/features' },
  { url: '/features/board.html', expect: 301, location: '/features/board' },
  { url: '/index.html', expect: 301, location: '/' },

  // Page moves
  { url: '/superset', expect: 301, location: '/comparison/superset' },
  { url: '/superset/', expect: 301, location: '/comparison/superset' },
  { url: '/superset.html', expect: 301, location: '/comparison/superset' },

  // 404
  { url: '/definitely-not-a-real-page', expect: 404 },
]

const results = []
for (const tc of cases) {
  const target = `${base}${tc.url}`
  let status = 0
  let location = ''
  try {
    const res = await fetch(target, { method: 'HEAD', redirect: 'manual' })
    status = res.status
    location = res.headers.get('location') ?? ''
  } catch (e) {
    status = -1
    location = String(e)
  }
  const locOk = tc.location === undefined || normalize(location) === tc.location
  const ok = status === tc.expect && locOk
  results.push({ ok, url: tc.url, status, expect: tc.expect, location, expectLocation: tc.location ?? '' })
}

function normalize(loc) {
  if (!loc) return ''
  try {
    return new URL(loc, base).pathname
  } catch {
    return loc
  }
}

const pad = (s, n) => String(s).padEnd(n)
console.log(`base: ${base}\n`)
console.log(pad('OK', 4) + pad('URL', 38) + pad('STATUS', 12) + pad('LOCATION', 36) + 'EXPECTED')
console.log('-'.repeat(120))
for (const r of results) {
  const mark = r.ok ? '✓' : '✗'
  const loc = r.location ? normalize(r.location) : '—'
  const exp = r.expectLocation || (r.expect === 200 ? '200' : `${r.expect}`)
  console.log(pad(mark, 4) + pad(r.url, 38) + pad(`${r.status} (want ${r.expect})`, 12) + pad(loc, 36) + exp)
}

const failed = results.filter((r) => !r.ok)
if (failed.length) {
  console.error(`\n[test-redirects] ${failed.length}/${results.length} FAILED`)
  process.exit(1)
}
console.log(`\n[test-redirects] all ${results.length} passed ✓`)
