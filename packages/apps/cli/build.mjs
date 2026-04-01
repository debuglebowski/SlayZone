import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const appPkg = JSON.parse(readFileSync(new URL('../app/package.json', import.meta.url), 'utf-8'))

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/slay.js',
  banner: { js: '#!/usr/bin/env node' },
  external: ['node:sqlite'],
  define: { __APP_VERSION__: JSON.stringify(appPkg.version) },
})
